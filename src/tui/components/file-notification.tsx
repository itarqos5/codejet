import React from "react";
import { Box, Text } from "ink";

export function FileNotification({
  filePath,
  action,
}: {
  filePath: string;
  action: "created" | "modified" | "deleted";
}) {
  const icon = action === "created" ? "+" : action === "deleted" ? "-" : "~";
  const color = action === "created" ? "green" : action === "deleted" ? "red" : "yellow";
  const label = action === "created" ? "Created" : action === "deleted" ? "Deleted" : "Modified";

  return (
    <Box gap={1} paddingLeft={2}>
      <Text color={color} bold>
        [{icon}]
      </Text>
      <Text color={color}>
        {label}{" "}
        <Text bold>{filePath}</Text>
      </Text>
    </Box>
  );
}
