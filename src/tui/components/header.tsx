import React from "react";
import { Box, Text } from "ink";
import { VERSION } from "../models.js";

// Compact single-line ASCII brand - always visible, no scroll
const BRAND = "◆ CODEJET";

export function Header({ model, mode }: { model: string; mode: string }) {
  const columns = process.stdout.columns ?? 80;
  const modeColor = mode === "build" ? "blue" : "yellow";
  const modeLabel = mode === "build" ? "BUILD" : "PLAN";

  return (
    <Box flexDirection="column" paddingX={1} paddingY={0}>
      {/* Main header line - compact, always visible */}
      <Box justifyContent="space-between" alignItems="center">
        {/* Brand */}
        <Box gap={1} alignItems="center">
          <Text color="cyan" bold>{BRAND}</Text>
          <Text color="gray" dimColor>v{VERSION}</Text>
        </Box>

        {/* Model + Mode */}
        <Box gap={2} alignItems="center">
          <Text color="yellow" bold>{model}</Text>
          <Text color="gray">│</Text>
          <Text color={modeColor} bold>{modeLabel}</Text>
        </Box>
      </Box>

      {/* Separator line */}
      <Text color="gray" dimColor>
        {"─".repeat(Math.min(columns - 4, 120))}
      </Text>
    </Box>
  );
}
