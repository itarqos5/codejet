import React from "react";
import { Box, Text } from "ink";
import { COLOR, GLYPH, truncate } from "../theme.js";
import { VERSION } from "../models.js";

/**
 * Startup banner.
 *
 * Printed exactly once into the static transcript, so it scrolls away with
 * history instead of being redrawn every frame. Persistent state that the user
 * needs at all times lives in the bottom status bar instead.
 */
export function Banner({ width, cwd, model }: { width: number; cwd: string; model: string }) {
  const safeWidth = Math.max(20, width);

  return (
    <Box flexDirection="column" width={safeWidth}>
      <Box flexDirection="row">
        <Text color={COLOR.accent} bold>
          {GLYPH.brand} codejet
        </Text>
        <Text color={COLOR.muted} dimColor>
          {"  "}v{VERSION}
        </Text>
      </Box>

      <Text color={COLOR.muted} dimColor wrap="truncate-end">
        {"  "}
        {truncate(cwd, safeWidth - 2)}
      </Text>
      <Text color={COLOR.muted} dimColor wrap="truncate-end">
        {"  "}
        {truncate(model, safeWidth - 2)}
      </Text>

      <Box height={1} />
    </Box>
  );
}
