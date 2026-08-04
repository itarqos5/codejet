import React from "react";
import { Box, Text } from "ink";

export function PlanPrompt({
  onProceed,
  onDismiss,
}: {
  onProceed: () => void;
  onDismiss: () => void;
}) {
  return (
    <Box
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
      flexDirection="column"
      marginBottom={1}
    >
      <Text color="yellow" bold>
        Plan ready!
      </Text>
      <Text color="gray">
        Press <Text color="green" bold>[Enter]</Text> to proceed with build mode, or <Text color="red" bold>[Esc]</Text> to dismiss.
      </Text>
    </Box>
  );
}
