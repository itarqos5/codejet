import React from "react";
import figlet from "figlet";
import { Box, Text } from "ink";
import { COLOR, rule, truncate } from "../theme.js";
import { VERSION } from "../models.js";
import type { AppMode } from "../state.js";

const LOGO_LINES = figlet
  .textSync("CODEJET", { font: "Small" })
  .trimEnd()
  .split("\n")
  .map((line) => line.trimEnd());

const LOGO_WIDTH = Math.max(...LOGO_LINES.map((line) => line.length));

export function AppHeader({
  width,
  cwd,
  model,
  mode,
  compact,
}: {
  width: number;
  cwd: string;
  model: string;
  mode: AppMode;
  compact: boolean;
}) {
  const safeWidth = Math.max(20, width);
  const modeLabel = mode === "build" ? "BUILD" : "PLAN";
  const modeColor = mode === "build" ? COLOR.accent : COLOR.warning;

  if (compact) {
    const right = `v${VERSION}  ${modeLabel}`;
    const brandBudget = Math.max(7, safeWidth - right.length - 2);
    return (
      <Box flexDirection="column" width={safeWidth} height={3} flexShrink={0}>
        <Box width={safeWidth} justifyContent="space-between">
          <Text color={COLOR.accent} bold>
            {truncate("CODEJET", brandBudget)}
          </Text>
          <Text wrap="truncate-end">
            <Text color={COLOR.muted}>v{VERSION}  </Text>
            <Text color={modeColor} bold>
              {modeLabel}
            </Text>
          </Text>
        </Box>
        <Text color={COLOR.textDim} wrap="truncate-end">
          {truncate(`${model}  |  ${cwd}`, safeWidth)}
        </Text>
        <Text color={COLOR.border}>{rule(safeWidth)}</Text>
      </Box>
    );
  }

  if (safeWidth >= 100) {
    const detailsWidth = Math.max(20, safeWidth - LOGO_WIDTH - 4);
    return (
      <Box flexDirection="column" width={safeWidth} height={5} flexShrink={0}>
        <Box flexDirection="row" width={safeWidth} height={4}>
          <Box flexDirection="column" width={LOGO_WIDTH} flexShrink={0}>
            {LOGO_LINES.map((line, index) => (
              <Text key={index} color={COLOR.accent} bold>
                {line}
              </Text>
            ))}
          </Box>
          <Box
            flexDirection="column"
            width={detailsWidth}
            paddingLeft={3}
            justifyContent="center"
          >
            <Text wrap="truncate-end">
              <Text color={modeColor} bold>
                {modeLabel}
              </Text>
              <Text color={COLOR.muted}>  v{VERSION}</Text>
            </Text>
            <Text color={COLOR.text} wrap="truncate-end">
              {truncate(model, detailsWidth - 3)}
            </Text>
            <Text color={COLOR.textDim} wrap="truncate-end">
              {truncate(cwd, detailsWidth - 3)}
            </Text>
          </Box>
        </Box>
        <Text color={COLOR.border}>{rule(safeWidth)}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={safeWidth} height={5} flexShrink={0}>
      {LOGO_LINES.map((line, index) => (
        <Text key={index} color={COLOR.accent} bold wrap="truncate-end">
          {truncate(line, safeWidth)}
        </Text>
      ))}
      <Text wrap="truncate-end">
        <Text color={modeColor} bold>
          {modeLabel}
        </Text>
        <Text color={COLOR.muted}>
          {"  "}v{VERSION}{"  |  "}
        </Text>
        <Text color={COLOR.textDim}>
          {truncate(
            `${model}  |  ${cwd}`,
            Math.max(0, safeWidth - modeLabel.length - 12),
          )}
        </Text>
      </Text>
    </Box>
  );
}
