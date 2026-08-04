import React from "react";
import { Box, Text } from "ink";

export function UpdateToast({
  version,
  onInstall,
  onDismiss,
}: {
  version: string;
  onInstall: () => void;
  onDismiss: () => void;
}) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
      paddingY={0}
      marginBottom={1}
    >
      <Box justifyContent="space-between" alignItems="center">
        <Box gap={1} alignItems="center">
          <Text color="yellow" bold>◆</Text>
          <Text color="white">
            A new version (<Text color="cyan" bold>v{version}</Text>) is available, would you like to install it?
          </Text>
        </Box>
      </Box>
      <Box gap={2} paddingTop={1}>
        <Box borderStyle="round" borderColor="green" paddingX={1}>
          <Text color="green" bold>[Enter] Install</Text>
        </Box>
        <Box borderStyle="round" borderColor="gray" paddingX={1}>
          <Text color="gray">[Esc] Dismiss</Text>
        </Box>
      </Box>
    </Box>
  );
}
