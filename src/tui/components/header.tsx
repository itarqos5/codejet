import React from "react";
import figlet from "figlet";
import { Box, Text } from "ink";
import { COLOR, truncate } from "../theme.js";
import { VERSION } from "../models.js";

/**
 * Startup splash.
 *
 * Printed exactly once into the static transcript, so it scrolls away with
 * history instead of being redrawn every frame. The live frame carries no
 * header chrome at all — just the conversation, the prompt and the status
 * line, which keeps the surface calm and leaves every spare row for output.
 */

function wordmark(font: "Standard" | "Small"): string[] {
  return figlet
    .textSync("CODE JET", { font })
    .replace(/\s+$/, "")
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""));
}

const LOGO_STANDARD = wordmark("Standard");
const LOGO_SMALL = wordmark("Small");
const LOGO_STANDARD_WIDTH = Math.max(...LOGO_STANDARD.map((l) => l.length));
const LOGO_SMALL_WIDTH = Math.max(...LOGO_SMALL.map((l) => l.length));

export function Welcome({
  width,
  cwd,
  model,
}: {
  width: number;
  cwd: string;
  model: string;
}) {
  const safeWidth = Math.max(20, width);

  // Pick the largest wordmark that fits with a little breathing room.
  const logo =
    safeWidth >= LOGO_STANDARD_WIDTH + 4
      ? LOGO_STANDARD
      : safeWidth >= LOGO_SMALL_WIDTH + 4
        ? LOGO_SMALL
        : null;

  return (
    <Box flexDirection="column" width={safeWidth}>
      <Box height={1} />
      {logo ? (
        logo.map((line, index) => (
          <Text key={index} color={COLOR.accent} bold wrap="truncate-end">
            {truncate(line, safeWidth)}
          </Text>
        ))
      ) : (
        <Text color={COLOR.accent} bold>
          CODE JET
        </Text>
      )}
      <Box height={1} />
      <Text wrap="truncate-end">
        <Text color={COLOR.muted}>v{VERSION}</Text>
        <Text color={COLOR.textDim}>{"  ·  "}{truncate(model, Math.max(8, safeWidth - 12))}</Text>
      </Text>
      <Text color={COLOR.muted} dimColor wrap="truncate-end">
        {truncate(cwd, safeWidth)}
      </Text>
      <Box height={1} />
    </Box>
  );
}
