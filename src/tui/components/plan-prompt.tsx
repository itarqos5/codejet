import React from "react";
import { Box, Text } from "ink";
import { COLOR } from "../theme.js";

/** Inline confirmation shown after a plan-mode response. */
export function PlanPrompt({ width }: { width: number }) {
  const inner = Math.max(8, width - 4);

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle="round"
      borderColor={COLOR.warning}
      paddingX={1}
    >
      <Box width={inner}>
        <Text color={COLOR.warning} bold wrap="truncate-end">
          Plan ready
        </Text>
      </Box>
      <Box width={inner}>
        <Text color={COLOR.muted} wrap="truncate-end">
          ↵ switch to build and continue   esc keep planning
        </Text>
      </Box>
    </Box>
  );
}
