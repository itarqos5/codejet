import React from "react";
import { Box, Text } from "ink";
import { COLOR, GLYPH, truncate } from "../theme.js";

/** Transient single-row notice that a file changed. */
export function FileNotification({
  filePath,
  action,
  width,
}: {
  filePath: string;
  action: "created" | "modified" | "deleted";
  width: number;
}) {
  const color =
    action === "created" ? COLOR.success : action === "deleted" ? COLOR.error : COLOR.warning;
  const label = action === "created" ? "Created" : action === "deleted" ? "Deleted" : "Modified";

  return (
    <Box width={width} flexDirection="row">
      <Text wrap="truncate-end">
        <Text color={color}>{GLYPH.toolDone} </Text>
        <Text color={color}>{label}</Text>
        <Text color={COLOR.textDim}>
          {" "}
          {truncate(filePath, Math.max(0, width - label.length - 4))}
        </Text>
      </Text>
    </Box>
  );
}
