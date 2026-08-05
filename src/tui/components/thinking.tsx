import React from "react";
import { Box, Text } from "ink";
import { COLOR, GLYPH, truncate } from "../theme.js";
import { Spinner, Elapsed } from "./spinner.js";

/**
 * Live "Thinking" indicator shown while the model is reasoning or a request is
 * in flight. Renders a spinner, elapsed time, and — when the model has emitted
 * reasoning via the think() tool or a reasoning stream — a dimmed tail of that
 * reasoning so the user can see progress instead of a frozen screen.
 */
export function ThinkingIndicator({
  label,
  detail,
  since,
  width,
  maxDetailLines = 3,
}: {
  label?: string;
  detail?: string;
  since: number;
  width: number;
  maxDetailLines?: number;
}) {
  const safeWidth = Math.max(20, width);
  const tail = (detail ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-maxDetailLines);

  return (
    <Box flexDirection="column" width={safeWidth}>
      <Box flexDirection="row" width={safeWidth}>
        <Spinner color={COLOR.thinking} />
        <Text color={COLOR.thinking} bold>
          {" "}
          {label ?? "Thinking"}
        </Text>
        <Elapsed since={since} />
        {/* Only offer the hint when there is genuinely room for it. */}
        {safeWidth >= 44 && (
          <Text color={COLOR.muted} dimColor>
            {"  esc to interrupt"}
          </Text>
        )}
      </Box>

      {tail.length > 0 && (
        <Box flexDirection="column" width={safeWidth} paddingLeft={2}>
          {tail.map((line, i) => (
            <Text key={i} color={COLOR.muted} dimColor italic wrap="truncate-end">
              {truncate(line, safeWidth - 3)}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

/**
 * A completed thinking phase, kept in the transcript as one collapsed line —
 * "✻ Thought for 3.2s" — and nothing more. Reasoning text itself is only ever
 * shown in the live indicator while the turn is in flight; finished entries
 * live in the static transcript, which is written once and never redrawn, so
 * there is no expandable dropdown to reopen.
 */
export function ThoughtBlock({
  durationMs,
  width,
}: {
  durationMs?: number;
  width: number;
}) {
  const safeWidth = Math.max(20, width);

  const label =
    durationMs === undefined
      ? "Thought"
      : durationMs < 1000
        ? `Thought for ${Math.round(durationMs)}ms`
        : `Thought for ${(durationMs / 1000).toFixed(1)}s`;

  return (
    <Box flexDirection="row" width={safeWidth}>
      <Text color={COLOR.thinking}>{GLYPH.thinking} </Text>
      <Text color={COLOR.text} wrap="truncate-end">
        {truncate(label, safeWidth - 3)}
      </Text>
    </Box>
  );
}
