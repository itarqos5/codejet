import React from "react";
import { Box, Text } from "ink";
import { formatContextUsage } from "../models.js";
import type { AppMode } from "../state.js";

export function StatusBar({
  mode,
  modelId,
  contextUsed,
  contextMax,
  streaming,
  todoCount,
}: {
  mode: AppMode;
  modelId: string;
  contextUsed: number;
  contextMax: number;
  streaming: boolean;
  todoCount: number;
}) {
  const contextStr = formatContextUsage(contextUsed, contextMax);
  const modeColor = mode === "build" ? "blue" : "orange";

  return (
    <Box justifyContent="space-between" paddingX={1}>
      <Box gap={2}>
        <Text color="gray">
          Tab: <Text color={modeColor} bold>{mode}</Text>
        </Text>
        <Text color="gray">│</Text>
        <Text color="gray">
          {streaming ? (
            <Text color="yellow" bold>⟳ streaming</Text>
          ) : (
            "ready"
          )}
        </Text>
        {todoCount > 0 && (
          <>
            <Text color="gray">│</Text>
            <Text color="gray">
              ☑ <Text color="green">{todoCount}</Text> todos
            </Text>
          </>
        )}
      </Box>
      <Box gap={2}>
        <Text color="gray">
          <Text color="cyan">{contextStr}</Text>
        </Text>
        <Text color="gray">│</Text>
        <Text color="gray">
          Ctrl+P: <Text color="white" bold>commands</Text>
        </Text>
      </Box>
    </Box>
  );
}
