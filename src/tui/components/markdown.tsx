import React from "react";
import { Text, Box } from "ink";

interface MdSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  color?: string;
}

// Word wrap function to ensure text doesn't overflow
function wrapText(text: string, maxWidth: number): string[] {
  if (maxWidth <= 0) return [text];
  
  const lines: string[] = [];
  const paragraphs = text.split('\n');
  
  for (const paragraph of paragraphs) {
    if (paragraph === '') {
      lines.push('');
      continue;
    }
    
    const words = paragraph.split(' ');
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      
      // Check if adding this word exceeds the max width
      if (testLine.length > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
  }
  
  return lines;
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

export function MarkdownText({ content, maxWidth }: { content: string; maxWidth?: number }) {
  const columns = maxWidth ?? Math.min(process.stdout.columns ?? 80, 76);
  const usableWidth = Math.max(20, columns - 4); // Reserve space for borders/padding
  
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
                {cl.length > usableWidth ? cl.slice(0, usableWidth - 3) + "..." : cl}
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
      const headerText = line.slice(2);
      elements.push(
        <Box key={i} marginBottom={0}>
          <Text bold color="cyan">
            {headerText}
          </Text>
        </Box>
      );
    } else if (line.startsWith("## ")) {
      const headerText = line.slice(3);
      elements.push(
        <Box key={i} marginBottom={0}>
          <Text bold color="blue">
            {headerText}
          </Text>
        </Box>
      );
    } else if (line.startsWith("### ")) {
      const headerText = line.slice(4);
      elements.push(
        <Box key={i} marginBottom={0}>
          <Text bold color="magenta">
            {headerText}
          </Text>
        </Box>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const bulletContent = line.slice(2);
      const wrappedLines = wrapText(bulletContent, usableWidth - 3);
      elements.push(
        <Box key={i} paddingLeft={2} gap={1}>
          <Text color="cyan">•</Text>
          <Box flexDirection="column">
            {wrappedLines.map((wl, wi) => (
              <InlineText key={wi} segments={parseInline(wl)} />
            ))}
          </Box>
        </Box>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\.\s/)?.[1] ?? "";
      const rest = line.replace(/^\d+\.\s/, "");
      const wrappedLines = wrapText(rest, usableWidth - num.length - 4);
      elements.push(
        <Box key={i} paddingLeft={2} gap={1}>
          <Text color="cyan">{num}.</Text>
          <Box flexDirection="column">
            {wrappedLines.map((wl, wi) => (
              <InlineText key={wi} segments={parseInline(wl)} />
            ))}
          </Box>
        </Box>
      );
    } else if (line.startsWith("> ")) {
      const quoteText = line.slice(2);
      const wrappedLines = wrapText(quoteText, usableWidth - 3);
      elements.push(
        <Box key={i} paddingLeft={2} gap={1} flexDirection="row">
          <Text color="gray" dimColor>│</Text>
          <Box flexDirection="column">
            {wrappedLines.map((wl, wi) => (
              <Text key={wi} italic color="gray">
                {wl}
              </Text>
            ))}
          </Box>
        </Box>
      );
    } else if (line.startsWith("---") || line.startsWith("***")) {
      elements.push(
        <Box key={i} paddingTop={0} paddingBottom={0}>
          <Text color="gray" dimColor>
            {"─".repeat(Math.min(40, usableWidth))}
          </Text>
        </Box>
      );
    } else if (line.trim() === "") {
      elements.push(<Text key={i}> </Text>);
    } else {
      // Regular paragraph - wrap text properly
      const wrappedLines = wrapText(line, usableWidth);
      elements.push(
        <Box key={i} flexDirection="column">
          {wrappedLines.map((wl, wi) => (
            <Box key={wi}>
              <InlineText segments={parseInline(wl)} />
            </Box>
          ))}
        </Box>
      );
    }
  }

  if (inCodeBlock && codeLines.length > 0) {
    elements.push(
      <Box key="code-end" flexDirection="column" paddingLeft={2} marginBottom={1}>
        {codeLines.map((cl, j) => (
          <Text key={j} color="green" dimColor>
            {cl.length > usableWidth ? cl.slice(0, usableWidth - 3) + "..." : cl}
          </Text>
        ))}
      </Box>
    );
  }

  return <>{elements}</>;
}
