import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { formatContextUsage } from "../models.js";
import type { AppMode } from "../state.js";

function StreamingDot() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setFrame((f) => (f + 1) % 4), 250);
    return () => clearInterval(interval);
  }, []);

  const dots = ".".repeat(frame + 1);
  return <Text color="yellow" bold>Processing{dots.padEnd(4)}</Text>;
}

export function StatusBar({
  mode,
  modelId,
  contextUsed,
  contextMax,
  streaming,
  cancelPending,
  todoCount,
}: {
  mode: AppMode;
  modelId: string;
  contextUsed: number;
  contextMax: number;
  streaming: boolean;
  cancelPending: boolean;
  todoCount: number;
}) {
  const contextStr = formatContextUsage(contextUsed, contextMax);
  const contextPercent = contextMax > 0 ? Math.round((contextUsed / contextMax) * 100) : 0;
  const modeColor = mode === "build" ? "blue" : "yellow";
  const modeLabel = mode === "build" ? "BUILD" : "PLAN";

  // Context bar
  const barWidth = 10;
  const filledWidth = Math.min(Math.round((contextPercent / 100) * barWidth), barWidth);
  const contextBar = "█".repeat(filledWidth) + "░".repeat(barWidth - filledWidth);
  const barColor = contextPercent > 80 ? "red" : contextPercent > 60 ? "yellow" : "cyan";

  return (
    <Box justifyContent="space-between" paddingX={1}>
      {/* Left side - Mode and status */}
      <Box gap={2} alignItems="center">
        {/* Mode indicator */}
        <Text color={modeColor} bold>[{modeLabel}]</Text>

        <Text color="gray">│</Text>

        {/* Streaming indicator with ESC hint */}
        <Box gap={1} alignItems="center">
          {streaming ? (
            <>
              <StreamingDot />
              <Text color="gray">│</Text>
              {cancelPending ? (
                <Text color="red" bold>Press ESC again to confirm cancel</Text>
              ) : (
                <Text color="gray" dimColor>Press ESC to cancel</Text>
              )}
            </>
          ) : (
            <>
              <Text color="green">●</Text>
              <Text color="gray" dimColor>Ready</Text>
            </>
          )}
        </Box>

        {/* Todo count */}
        {todoCount > 0 && (
          <>
            <Text color="gray">│</Text>
            <Text color="magenta" bold>☑ {todoCount}</Text>
          </>
        )}
      </Box>

      {/* Right side - Context and help */}
      <Box gap={2} alignItems="center">
        <Box gap={1} alignItems="center">
          <Text color={barColor}>{contextBar}</Text>
          <Text color="white">{contextStr}</Text>
        </Box>
        <Text color="gray">│</Text>
        <Text color="gray" dimColor>Ctrl+P</Text>
      </Box>
    </Box>
  );
}
