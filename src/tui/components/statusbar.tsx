import React from "react";
import { Box, Text } from "ink";
import { COLOR, truncate } from "../theme.js";
import { formatContextUsage } from "../models.js";
import type { AppMode } from "../state.js";

/**
 * Bottom status bar: one row, always exactly `width` cells.
 *
 * Both halves are measured and the left half is truncated so the two can never
 * collide or push the row past the terminal edge, which is what made the old
 * header text overlap the model name.
 */
export function StatusBar({
  mode,
  modelName,
  contextUsed,
  contextMax,
  busy,
  cancelPending,
  todoCount,
  width,
}: {
  mode: AppMode;
  modelName: string;
  contextUsed: number;
  contextMax: number;
  busy: boolean;
  cancelPending: boolean;
  todoCount: number;
  width: number;
}) {
  const safeWidth = Math.max(20, width);

  const modeLabel = mode === "build" ? "build" : "plan";
  const modeColor = mode === "build" ? COLOR.accent : COLOR.warning;

  const percent = contextMax > 0 ? Math.round((contextUsed / contextMax) * 100) : 0;
  const barWidth = 8;
  const filled = Math.min(barWidth, Math.round((percent / 100) * barWidth));
  const bar = "▰".repeat(filled) + "▱".repeat(barWidth - filled);
  const barColor = percent > 85 ? COLOR.error : percent > 65 ? COLOR.warning : COLOR.accentSoft;
  const contextLabel = formatContextUsage(contextUsed, contextMax);

  // Right half is fixed content; reserve its exact width first.
  const rightText = `${bar} ${contextLabel}`;
  const rightWidth = rightText.length;

  const hints = cancelPending
    ? "esc again to cancel"
    : busy
      ? "esc interrupt"
      : "tab mode   ctrl+p menu";
  const todoPart = todoCount > 0 ? `   ${todoCount} todo${todoCount === 1 ? "" : "s"}` : "";

  const leftPlain = `${modeLabel}   ${hints}${todoPart}`;
  const leftBudget = Math.max(0, safeWidth - rightWidth - 2);
  const leftFits = leftPlain.length <= leftBudget;

  return (
    <Box width={safeWidth} flexDirection="row" justifyContent="space-between">
      <Box flexShrink={1}>
        {leftFits ? (
          <Text wrap="truncate-end">
            <Text color={modeColor} bold>
              {modeLabel}
            </Text>
            <Text color={cancelPending ? COLOR.error : COLOR.muted} dimColor={!cancelPending}>
              {"   "}
              {hints}
              {todoPart}
            </Text>
          </Text>
        ) : (
          <Text color={modeColor} bold wrap="truncate-end">
            {truncate(modeLabel, leftBudget)}
          </Text>
        )}
      </Box>

      <Box flexShrink={0}>
        <Text wrap="truncate-end">
          <Text color={barColor}>{bar}</Text>
          <Text color={COLOR.muted} dimColor>
            {" "}
            {contextLabel}
          </Text>
        </Text>
      </Box>
    </Box>
  );
}
