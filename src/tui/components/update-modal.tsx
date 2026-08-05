import React from "react";
import { Box, Text } from "ink";
import { COLOR, truncate } from "../theme.js";
import { Spinner } from "./spinner.js";
import type { UpdatePhase } from "../state.js";

export function ProgressBar({
  percent,
  width,
  color = COLOR.accent,
}: {
  percent: number;
  width: number;
  color?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const barWidth = Math.max(4, width);
  const filled = Math.round((clamped / 100) * barWidth);

  return (
    <Text wrap="truncate-end">
      <Text color={color}>{"▰".repeat(filled)}</Text>
      <Text color={COLOR.border}>{"▱".repeat(barWidth - filled)}</Text>
      <Text color={COLOR.muted} dimColor>
        {" "}
        {clamped}%
      </Text>
    </Text>
  );
}

/**
 * Update progress panel, rendered inline above the prompt rather than as a
 * full-screen absolute overlay drawn on top of the transcript.
 */
export function UpdatePanel({
  phase,
  currentTask,
  progress,
  error,
  width,
}: {
  phase: UpdatePhase;
  currentTask: string;
  progress: number;
  error?: string | null;
  width: number;
}) {
  if (phase === "idle" || phase === "checking") return null;

  const inner = Math.max(8, width - 4);
  const isDone = phase === "done";
  const isError = phase === "error";
  const color = isDone ? COLOR.success : isError ? COLOR.error : COLOR.accent;
  const title = isDone ? "Update complete" : isError ? "Update failed" : "Updating CodeJet";

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle="round"
      borderColor={color}
      paddingX={1}
    >
      <Box width={inner} flexDirection="row">
        {!isDone && !isError ? <Spinner color={color} /> : null}
        <Text color={color} bold wrap="truncate-end">
          {!isDone && !isError ? " " : ""}
          {title}
        </Text>
      </Box>

      {!isDone && !isError && (
        <Box width={inner}>
          <ProgressBar percent={progress} width={Math.min(24, inner - 6)} />
        </Box>
      )}

      <Box width={inner}>
        <Text
          color={isError ? COLOR.error : isDone ? COLOR.success : COLOR.textDim}
          wrap="truncate-end"
        >
          {truncate(
            isError
              ? (error || "An error occurred during the update")
              : isDone
                ? "Restart to load the new version"
                : currentTask || "Preparing…",
            inner,
          )}
        </Text>
      </Box>

      <Box width={inner}>
        <Text color={COLOR.muted} dimColor wrap="truncate-end">
          {isDone ? "↵ restart now" : isError ? "esc close" : "please wait…"}
        </Text>
      </Box>
    </Box>
  );
}
