import React from "react";
import { Text, Box } from "ink";

interface MdSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  color?: string;
}

function parseInline(text: string): MdSegment[] {
  const segments: MdSegment[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[([^\]]+)\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) });
    }

    const raw = match[0];
    if (raw.startsWith("`")) {
      segments.push({ text: raw.slice(1, -1), code: true, color: "green" });
    } else if (raw.startsWith("**")) {
      segments.push({ text: raw.slice(2, -2), bold: true });
    } else if (raw.startsWith("*")) {
      segments.push({ text: raw.slice(1, -1), italic: true });
    } else if (raw.startsWith("[")) {
      segments.push({ text: match[2], color: "cyan" });
    }

    lastIndex = match.index + raw.length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ text }];
}

function InlineText({ segments }: { segments: MdSegment[] }) {
  return (
    <>
      {segments.map((seg, i) => (
        <Text
          key={i}
          bold={seg.bold}
          italic={seg.italic}
          color={seg.code ? "green" : seg.color}
          inverse={seg.code}
        >
          {seg.text}
        </Text>
      ))}
    </>
  );
}

export function MarkdownText({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeLang = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <Box key={`code-${i}`} flexDirection="column" paddingLeft={2} marginBottom={1}>
            {codeLines.map((cl, j) => (
              <Text key={j} color="green" dimColor>
                {cl}
              </Text>
            ))}
          </Box>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (line.startsWith("# ")) {
      elements.push(
        <Box key={i} marginBottom={0}>
          <Text bold color="cyan">
            {line.slice(2)}
          </Text>
        </Box>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <Box key={i} marginBottom={0}>
          <Text bold color="blue">
            {line.slice(3)}
          </Text>
        </Box>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <Box key={i} marginBottom={0}>
          <Text bold color="magenta">
            {line.slice(4)}
          </Text>
        </Box>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <Box key={i} paddingLeft={2} gap={1}>
          <Text color="cyan">•</Text>
          <InlineText segments={parseInline(line.slice(2))} />
        </Box>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\.\s/)?.[1] ?? "";
      const rest = line.replace(/^\d+\.\s/, "");
      elements.push(
        <Box key={i} paddingLeft={2} gap={1}>
          <Text color="cyan">{num}.</Text>
          <InlineText segments={parseInline(rest)} />
        </Box>
      );
    } else if (line.startsWith("> ")) {
      elements.push(
        <Box key={i} paddingLeft={2} gap={1}>
          <Text color="gray" dimColor>│</Text>
          <Text italic color="gray">
            {line.slice(2)}
          </Text>
        </Box>
      );
    } else if (line.startsWith("---") || line.startsWith("***")) {
      elements.push(
        <Box key={i} paddingTop={0} paddingBottom={0}>
          <Text color="gray" dimColor>
            {"─".repeat(Math.min(40, process.stdout.columns ?? 80))}
          </Text>
        </Box>
      );
    } else if (line.trim() === "") {
      elements.push(<Text key={i}>{" "}</Text>);
    } else {
      elements.push(
        <Box key={i}>
          <InlineText segments={parseInline(line)} />
        </Box>
      );
    }
  }

  if (inCodeBlock && codeLines.length > 0) {
    elements.push(
      <Box key="code-end" flexDirection="column" paddingLeft={2} marginBottom={1}>
        {codeLines.map((cl, j) => (
          <Text key={j} color="green" dimColor>
            {cl}
          </Text>
        ))}
      </Box>
    );
  }

  return <>{elements}</>;
}
