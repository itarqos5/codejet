import React from "react";
import { Box, Text } from "ink";

export function UpdateToast({
  version,
  highlighted,
}: {
  version: string;
  highlighted: boolean;
}) {
  return (
    <Box
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
      justifyContent="space-between"
      marginBottom={1}
    >
      <Text color="yellow" bold>
        New update available: v{version}
      </Text>
      <Box gap={2}>
        <Text color={highlighted ? "green" : "gray"} bold>
          [Enter] Install
        </Text>
        <Text color="gray" dimColor>
          [Esc] Dismiss
        </Text>
      </Box>
    </Box>
  );
}
