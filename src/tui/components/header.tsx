import React, { useMemo } from "react";
import { Box, Text } from "ink";
import figlet from "figlet";
import { VERSION } from "../models.js";

export function Header({ model, mode }: { model: string; mode: string }) {
  const columns = process.stdout.columns ?? 80;
  const rows = process.stdout.rows ?? 24;

  const asciiArt = useMemo(() => {
    const font = columns >= 60 ? "ANSI Shadow" : "Small";
    const raw = figlet.textSync("CODEJET", { font, horizontalLayout: "fitted" });
    const lines = raw.split("\n");
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
    return lines;
  }, [columns]);

  const modeColor = mode === "build" ? "blue" : "yellow";

  // Push header down when terminal is tall (above 30 rows)
  const headerLines = asciiArt.length + 1; // ASCII + info line
  const statusBarLines = 1;
  const inputLines = 3;
  const available = rows - headerLines - statusBarLines - inputLines;
  const topPad = rows > 30 ? Math.floor(available * 0.15) : 0;

  return (
    <Box flexDirection="column" alignItems="center" paddingTop={topPad}>
      {asciiArt.map((line, i) => (
        <Text key={i} color="cyan" bold>
          {line}
        </Text>
      ))}
      <Box marginTop={0} gap={1} justifyContent="center">
        <Text color="white" dimColor>
          v{VERSION}
        </Text>
        <Text color="gray">│</Text>
        <Text color="yellow" bold>
          {model}
        </Text>
        <Text color="gray">│</Text>
        <Text color={modeColor} bold inverse>
          {" "}
          {mode.toUpperCase()}{" "}
        </Text>
      </Box>
    </Box>
  );
}
