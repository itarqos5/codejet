import React from "react";
import { Box, Text } from "ink";

export function UpdateModal({
  visible,
  phase,
  logLines,
  completed,
}: {
  visible: boolean;
  phase: string;
  logLines: string[];
  completed: boolean;
}) {
  if (!visible) return null;

  const rows = process.stdout.rows ?? 24;
  const topPad = Math.max(0, Math.floor((rows - 12) / 2));

  return (
    <Box flexDirection="column" width="100%" height="100%">
      {Array.from({ length: topPad }).map((_, i) => (
        <Text key={i}>{" "}</Text>
      ))}
      <Box flexDirection="column" alignItems="center">
        <Box
          flexDirection="column"
          borderStyle="double"
          borderColor="green"
          paddingX={2}
          paddingTop={1}
          paddingBottom={1}
          width="70%"
        >
          <Box justifyContent="center" paddingBottom={1}>
            <Text color="green" bold>
              {completed ? "Update Complete" : "Installing Update..."}
            </Text>
          </Box>
          {!completed && (
            <Box justifyContent="center" paddingBottom={1}>
              <Text color="yellow" bold>
                {phase}
              </Text>
            </Box>
          )}
          <Box flexDirection="column" paddingBottom={1}>
            {logLines.map((line, i) => (
              <Text key={i} color="gray" dimColor>
                {line}
              </Text>
            ))}
          </Box>
          {completed && (
            <Box justifyContent="center" paddingTop={1}>
              <Text color="green" bold>
                [Enter] Restart Now
              </Text>
            </Box>
          )}
          <Box justifyContent="center" paddingTop={1}>
            <Text color="gray" dimColor>
              {completed ? "" : "Esc to cancel"}
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
