import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import type { UpdatePhase } from "../state.js";

// Steps in the update process with weights for progress estimation
const UPDATE_STEPS = [
  { label: "Fetching latest from origin...", weight: 15 },
  { label: "Pulling updates...", weight: 25 },
  { label: "Installing dependencies...", weight: 35 },
  { label: "Building project...", weight: 20 },
  { label: "Finalizing...", weight: 5 },
];

function ProgressBar({
  percent,
  width = 40,
  color = "cyan",
}: {
  percent: number;
  width?: number;
  color?: string;
}) {
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const filledWidth = Math.round((clampedPercent / 100) * width);
  const emptyWidth = width - filledWidth;

  const filled = "█".repeat(filledWidth);
  const empty = "░".repeat(emptyWidth);

  return (
    <Box gap={1} alignItems="center">
      <Text color={color}>{filled}</Text>
      <Text color="gray">{empty}</Text>
      <Text color="white" bold>{clampedPercent}%</Text>
    </Box>
  );
}

export function UpdateOverlay({
  phase,
  currentTask,
  progress,
  error,
}: {
  phase: UpdatePhase;
  currentTask: string;
  progress: number;
  error?: string | null;
}) {
  if (phase === "idle" || phase === "checking") return null;

  const rows = process.stdout.rows ?? 24;
  const cols = process.stdout.columns ?? 80;
  const overlayWidth = Math.min(60, cols - 10);
  const topPad = Math.max(2, Math.floor((rows - 10) / 2));

  const isDone = phase === "done";
  const isError = phase === "error";
  const borderColor = isDone ? "green" : isError ? "red" : "cyan";
  const title = isDone
    ? "Update Complete"
    : isError
    ? "Update Failed"
    : "Updating CodeJet";

  return (
    <Box
      flexDirection="column"
      position="absolute"
      width="100%"
      height="100%"
      justifyContent="center"
      alignItems="center"
    >
      {/* Semi-transparent overlay effect via empty lines */}
      {Array.from({ length: topPad }).map((_, i) => (
        <Text key={`pad-${i}`}>{" "}</Text>
      ))}

      <Box
        flexDirection="column"
        borderStyle="double"
        borderColor={borderColor}
        paddingX={2}
        paddingY={1}
        width={overlayWidth}
        alignItems="center"
      >
        {/* Title */}
        <Box paddingBottom={1} justifyContent="center">
          <Text color={borderColor} bold>
            {isDone ? "✓" : isError ? "✕" : "◈"} {title}
          </Text>
        </Box>

        {/* Progress bar */}
        {!isDone && !isError && (
          <Box flexDirection="column" paddingBottom={1} alignItems="center" width="100%">
            <ProgressBar
              percent={progress}
              width={Math.min(overlayWidth - 12, 35)}
              color="cyan"
            />
          </Box>
        )}

        {/* Current task label */}
        <Box paddingBottom={1} justifyContent="center">
          {isError ? (
            <Text color="red">{error || "An error occurred during update"}</Text>
          ) : isDone ? (
            <Text color="green">All changes applied successfully</Text>
          ) : (
            <Text color="yellow">{currentTask || "Preparing..."}</Text>
          )}
        </Box>

        {/* Action hints */}
        <Box paddingTop={1} justifyContent="center" gap={2}>
          {isDone && (
            <Box borderStyle="round" borderColor="green" paddingX={1}>
              <Text color="green" bold>[Enter] Restart</Text>
            </Box>
          )}
          {isError && (
            <Box borderStyle="round" borderColor="gray" paddingX={1}>
              <Text color="gray">[Esc] Close</Text>
            </Box>
          )}
          {phase === "installing" && (
            <Text color="gray" dimColor>Please wait...</Text>
          )}
        </Box>
      </Box>
    </Box>
  );
}
