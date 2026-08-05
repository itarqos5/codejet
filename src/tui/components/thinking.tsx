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
 * A completed thought, kept in the transcript.
 *
 * Rendered as a compact dimmed preview: enough to follow the model's reasoning
 * without burying the answer. The preview length is fixed rather than
 * toggleable because finished entries live in the static transcript, which is
 * written to the terminal once and never redrawn.
 */
export function ThoughtBlock({
  content,
  width,
  previewLines = 2,
}: {
  content: string;
  width: number;
  previewLines?: number;
}) {
  const safeWidth = Math.max(20, width);
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const shown = lines.slice(0, previewLines);
  const hidden = lines.length - shown.length;

  return (
    <Box flexDirection="column" width={safeWidth}>
      <Box flexDirection="row" width={safeWidth}>
        <Text color={COLOR.thinking}>{GLYPH.thinking} </Text>
        <Text color={COLOR.thinking}>Thought</Text>
        {hidden > 0 && (
          <Text color={COLOR.muted} dimColor>
            {"  +"}
            {hidden} more line{hidden === 1 ? "" : "s"}
          </Text>
        )}
      </Box>
      <Box flexDirection="column" width={safeWidth} paddingLeft={2}>
        {shown.map((line, i) => (
          <Text key={i} color={COLOR.muted} dimColor italic wrap="truncate-end">
            {truncate(line, safeWidth - 3)}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
