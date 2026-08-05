import React from "react";
import { Box, Text } from "ink";
import { COLOR } from "../theme.js";

/**
 * Update notice, rendered inline above the prompt.
 *
 * Previously this was an absolutely-positioned box nudged right with a computed
 * `marginLeft`, which drew straight over the header.
 */
export function UpdateToast({ version, width }: { version: string; width: number }) {
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
        <Text wrap="truncate-end">
          <Text color={COLOR.warning} bold>
            Update available
          </Text>
          <Text color={COLOR.muted} dimColor>
            {"  "}v{version}
          </Text>
        </Text>
      </Box>
      <Box width={inner}>
        <Text color={COLOR.muted} wrap="truncate-end">
          ↵ install now   esc dismiss
        </Text>
      </Box>
    </Box>
  );
}
