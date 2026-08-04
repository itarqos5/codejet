import React from "react";
import { Box, Text } from "ink";

const ASCII_ART = [
  "  ██████╗ ██████╗ ████████╗██╗███████╗███████╗",
  " ██╔════╝██╔═══██╗╚══██╔══╝██║██╔════╝██╔════╝",
  " ██║     ██║   ██║   ██║   ██║█████╗  ███████╗",
  " ██║     ██║   ██║   ██║   ██║██╔══╝  ╚════██║",
  " ╚██████╗╚██████╔╝   ██║   ██║███████╗███████║",
  "  ╚═════╝ ╚═════╝    ╚═╝   ╚═╝╚══════╝╚══════╝",
];

export function Header({ model, mode }: { model: string; mode: string }) {
  return (
    <Box flexDirection="column" alignItems="center" paddingTop={1}>
      {ASCII_ART.map((line, i) => (
        <Text key={i} color="cyan" bold>
          {line}
        </Text>
      ))}
      <Box marginTop={1} gap={2}>
        <Text color="gray" dimColor>
          v1.0.0
        </Text>
        <Text color="gray">│</Text>
        <Text color="yellow" bold>
          {model}
        </Text>
        <Text color="gray">│</Text>
        <Text
          color={mode === "build" ? "blue" : "orange"}
          bold
          inverse
        >
          {" "}
          {mode.toUpperCase()}{" "}
        </Text>
      </Box>
    </Box>
  );
}
