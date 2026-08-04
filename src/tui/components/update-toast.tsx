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
  const columns = process.stdout.columns ?? 80;
  const width = Math.min(64, Math.max(36, columns - 4));

  return (
    <Box
      position="absolute"
      width={width}
      marginLeft={Math.max(0, columns - width)}
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
      paddingY={0}
      backgroundColor="#161b22"
    >
      <Box justifyContent="space-between" alignItems="center">
        <Text color="yellow" bold>Update available</Text>
        <Text color="gray">[Esc] dismiss</Text>
      </Box>
      <Text color="white">
        New version <Text color="cyan" bold>v{version}</Text> is available.
      </Text>
      <Text color="gray">Would you like to install it?</Text>
      <Box gap={2} paddingTop={1}>
        <Text color="green" bold>[Enter] Install</Text>
        <Text color="gray">[X] Close</Text>
      </Box>
    </Box>
  );
}
