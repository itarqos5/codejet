import React from "react";
import { Box, Text } from "ink";
import { COLOR, GLYPH } from "../theme.js";

/**
 * Markdown renderer for streamed model output.
 *
 * Two rules keep this stable, and both were violated by the previous version:
 *
 *  1. The root is always a `flexDirection="column"` Box. Previously this
 *     returned a bare fragment of Boxes which the caller mounted into a
 *     row-direction Box, so ink laid every line out side by side and squeezed
 *     each one into a few characters — the "vertical column fragments" bug.
 *
 *  2. Wrapping is delegated to ink. Hand-rolled character counting cannot know
 *     about the widths ink actually computes, so it always drifts. Every block
 *     is given an explicit width budget and ink wraps inside it.
 */

interface Segment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  color?: string;
}

/**
 * Model output can contain raw ANSI escapes or stray control characters. Those
 * bypass ink's width accounting entirely and shift every subsequent character,
 * so they are stripped before anything is measured or drawn.
 */
function sanitize(raw: string): string {
  return raw
    // eslint-disable-next-line no-control-regex
    .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, "  ");
}

const INLINE_PATTERN =
  /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\*[^*\n]+\*|_[^_\n]+_|\[[^\]\n]+\]\([^)\n]*\))/g;

function parseInline(text: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  INLINE_PATTERN.lastIndex = 0;
  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) });
    }

    const raw = match[0];
    if (raw.startsWith("`")) {
      segments.push({ text: raw.slice(1, -1), code: true });
    } else if (raw.startsWith("**")) {
      segments.push({ text: raw.slice(2, -2), bold: true });
    } else if (raw.startsWith("__")) {
      segments.push({ text: raw.slice(2, -2), bold: true });
    } else if (raw.startsWith("~~")) {
      segments.push({ text: raw.slice(2, -2), strikethrough: true });
    } else if (raw.startsWith("[")) {
      const label = raw.slice(1, raw.indexOf("]"));
      segments.push({ text: label, color: COLOR.info });
    } else if (raw.startsWith("*") || raw.startsWith("_")) {
      segments.push({ text: raw.slice(1, -1), italic: true });
    }

    lastIndex = match.index + raw.length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ text }];
}

/**
 * Renders inline segments as a single wrapping Text. Nesting Text inside Text
 * lets ink wrap the flattened string, so styling never affects line breaking.
 */
function Inline({ text, color }: { text: string; color?: string }) {
  const segments = parseInline(text);
  return (
    <Text wrap="wrap" color={color ?? COLOR.text}>
      {segments.map((seg, i) => (
        <Text
          key={i}
          bold={seg.bold}
          italic={seg.italic}
          strikethrough={seg.strikethrough}
          color={seg.code ? COLOR.code : (seg.color ?? color ?? COLOR.text)}
          backgroundColor={seg.code ? COLOR.codeBg : undefined}
        >
          {seg.text}
        </Text>
      ))}
    </Text>
  );
}

function CodeBlock({
  lines,
  language,
  width,
}: {
  lines: string[];
  language: string;
  width: number;
}) {
  // Code must not wrap — wrapped code is unreadable and misleads about
  // indentation. It is truncated to the available width instead.
  const contentWidth = Math.max(8, width - 2);

  // No vertical margin: markdown already carries blank lines around fences, and
  // adding margin on top of those produced doubled blank rows.
  return (
    <Box flexDirection="column" width={width}>
      {language ? (
        <Text color={COLOR.muted} dimColor>
          {GLYPH.gutter} {language}
        </Text>
      ) : null}
      {lines.map((line, i) => (
        <Text key={i} wrap="truncate-end">
          <Text color={COLOR.muted} dimColor>
            {GLYPH.gutter}{" "}
          </Text>
          <Text color={COLOR.code}>{line.slice(0, contentWidth)}</Text>
        </Text>
      ))}
    </Box>
  );
}

/**
 * An indented block: a fixed-width marker column plus a flexible content
 * column. Both children get explicit widths so ink never has to guess.
 */
function IndentedRow({
  marker,
  markerColor,
  width,
  children,
}: {
  marker: string;
  markerColor: string;
  width: number;
  children: (contentWidth: number) => React.ReactNode;
}) {
  const markerWidth = marker.length + 1;
  const contentWidth = Math.max(8, width - markerWidth);

  return (
    <Box flexDirection="row" width={width}>
      <Box width={markerWidth} flexShrink={0}>
        <Text color={markerColor}>{marker}</Text>
      </Box>
      <Box flexDirection="column" width={contentWidth}>
        {children(contentWidth)}
      </Box>
    </Box>
  );
}

export function MarkdownText({
  content,
  width,
  baseColor,
}: {
  content: string;
  /** Total width available to this block, slack already deducted by the caller. */
  width: number;
  baseColor?: string;
}) {
  const safeWidth = Math.max(20, width);
  const lines = sanitize(content).split("\n");
  const blocks: React.ReactNode[] = [];

  let codeLines: string[] | null = null;
  let codeLang = "";
  let blankRun = 0;

  // Consecutive plain-text lines are reflowed into one paragraph so the terminal
  // wraps at the real edge instead of inheriting arbitrary source line breaks.
  let paragraph: string[] = [];

  const flushCode = (key: string) => {
    if (codeLines) {
      blocks.push(
        <CodeBlock key={key} lines={codeLines} language={codeLang} width={safeWidth} />,
      );
      codeLines = null;
      codeLang = "";
    }
  };

  const flushParagraph = (key: string) => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(" ");
    paragraph = [];
    blocks.push(
      <Box key={key} width={safeWidth}>
        <Inline text={text} color={baseColor} />
      </Box>,
    );
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced code blocks
    const fence = line.match(/^\s*```(.*)$/);
    if (fence) {
      flushParagraph(`p-${i}`);
      if (codeLines) {
        flushCode(`code-${i}`);
      } else {
        codeLines = [];
        codeLang = fence[1].trim();
      }
      continue;
    }

    if (codeLines) {
      codeLines.push(line);
      continue;
    }

    // Collapse runs of blank lines to a single spacer so streamed output does
    // not accumulate vertical dead space.
    if (line.trim() === "") {
      flushParagraph(`p-${i}`);
      blankRun++;
      if (blankRun === 1 && blocks.length > 0) {
        blocks.push(<Box key={`sp-${i}`} height={1} />);
      }
      continue;
    }
    blankRun = 0;

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph(`p-${i}`);
      const level = heading[1].length;
      const color = level === 1 ? COLOR.accent : level === 2 ? COLOR.info : COLOR.thinking;
      blocks.push(
        <Box key={i} width={safeWidth}>
          <Text bold color={color} wrap="wrap">
            {heading[2]}
          </Text>
        </Box>,
      );
      continue;
    }

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      flushParagraph(`p-${i}`);
      blocks.push(
        <Box key={i} width={safeWidth}>
          <Text color={COLOR.border} dimColor>
            {"─".repeat(safeWidth)}
          </Text>
        </Box>,
      );
      continue;
    }

    const bullet = line.match(/^(\s*)[-*+]\s+(.*)$/);
    if (bullet) {
      flushParagraph(`p-${i}`);
      const depth = Math.min(2, Math.floor(bullet[1].length / 2));
      const indent = "  ".repeat(depth);
      blocks.push(
        <IndentedRow
          key={i}
          marker={`${indent}${GLYPH.bullet}`}
          markerColor={COLOR.accent}
          width={safeWidth}
        >
          {() => <Inline text={bullet[2]} color={baseColor} />}
        </IndentedRow>,
      );
      continue;
    }

    const ordered = line.match(/^(\s*)(\d+)[.)]\s+(.*)$/);
    if (ordered) {
      flushParagraph(`p-${i}`);
      const indent = "  ".repeat(Math.min(2, Math.floor(ordered[1].length / 2)));
      blocks.push(
        <IndentedRow
          key={i}
          marker={`${indent}${ordered[2]}.`}
          markerColor={COLOR.accent}
          width={safeWidth}
        >
          {() => <Inline text={ordered[3]} color={baseColor} />}
        </IndentedRow>,
      );
      continue;
    }

    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      flushParagraph(`p-${i}`);
      blocks.push(
        <IndentedRow
          key={i}
          marker={GLYPH.quote}
          markerColor={COLOR.muted}
          width={safeWidth}
        >
          {() => (
            <Text italic color={COLOR.textDim} wrap="wrap">
              {quote[1]}
            </Text>
          )}
        </IndentedRow>,
      );
      continue;
    }

    // Plain text: buffer it so the paragraph can be reflowed as a whole.
    paragraph.push(line.trim());
  }

  flushParagraph("p-tail");
  // An unterminated fence is normal while streaming — render what we have.
  flushCode("code-tail");

  return (
    <Box flexDirection="column" width={safeWidth}>
      {blocks}
    </Box>
  );
}
