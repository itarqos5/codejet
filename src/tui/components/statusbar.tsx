import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { formatContextUsage } from "../models.js";
import type { AppMode } from "../state.js";

function AnimatedDot({ active }: { active: boolean }) {
  const [show, setShow] = useState(true);
  
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => setShow((s) => !s), 300);
    return () => clearInterval(interval);
  }, [active]);
  
  if (!active) return <Text color="green">●</Text>;
  return <Text color={show ? "green" : "green" as any} dimColor>○</Text>;
}

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
  const contextPercent = contextMax > 0 ? Math.round((contextUsed / contextMax) * 100) : 0;
  const modeColor = mode === "build" ? "blue" : "yellow";
  const modeLabel = mode === "build" ? "BUILD" : "PLAN";

  // Context bar
  const barWidth = 10;
  const filledWidth = Math.min(Math.round((contextPercent / 100) * barWidth), barWidth);
  const contextBar = "█".repeat(filledWidth) + "░".repeat(barWidth - filledWidth);
  const barColor = contextPercent > 80 ? "red" : contextPercent > 60 ? "yellow" : "cyan";

  return (
    <Box justifyContent="space-between" paddingX={1} borderStyle="bold" borderColor="#333333">
      {/* Left side - Mode and status */}
      <Box gap={2} alignItems="center">
        {/* Mode indicator */}
        <Box gap={0}>
          <Text color={modeColor} bold>┌</Text>
          <Text color={modeColor} bold>{modeLabel}</Text>
          <Text color={modeColor} bold>┐</Text>
        </Box>
        
        <Text color="gray">│</Text>
        
        {/* Streaming indicator */}
        <Box gap={1} alignItems="center">
          {streaming ? (
            <>
              <AnimatedDot active={true} />
              <Text color="yellow" bold>Processing</Text>
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
            <Box gap={1}>
              <Text color="magenta">☑</Text>
              <Text color="magenta" bold>{todoCount}</Text>
            </Box>
          </>
        )}
      </Box>
      
      {/* Right side - Context and help */}
      <Box gap={2} alignItems="center">
        {/* Context usage with visual bar */}
        <Box gap={1} alignItems="center">
          <Text color="gray">Context:</Text>
          <Text color={barColor}>{contextBar}</Text>
          <Text color="white">{contextStr}</Text>
        </Box>
        
        <Text color="gray">│</Text>
        
        {/* Help hint */}
        <Text color="gray" dimColor>Ctrl+P</Text>
      </Box>
    </Box>
  );
}
