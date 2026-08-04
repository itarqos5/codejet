import React, { useMemo } from "react";
import { Box, Text } from "ink";
import figlet from "figlet";

export function Header({ model, mode }: { model: string; mode: string }) {
  const columns = process.stdout.columns ?? 80;

  const asciiArt = useMemo(() => {
    const font = columns >= 60 ? "ANSI Shadow" : "Small";
    const raw = figlet.textSync("CODEJET", { font, horizontalLayout: "fitted" });
    const lines = raw.split("\n");
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
    return lines;
  }, [columns]);

  const modeColor = mode === "build" ? "blue" : "yellow";

  return (
    <Box flexDirection="column" alignItems="center" paddingTop={0}>
      {asciiArt.map((line, i) => (
        <Text key={i} color="cyan" bold>
          {line}
        </Text>
      ))}
      <Box marginTop={0} gap={1} justifyContent="center">
        <Text color="gray" dimColor>
          v1.0.0
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
