import React from "react";
import { Box, Text } from "ink";
import { TextInput } from "@inkjs/ui";
import type { AppMode } from "../state.js";

export function InputBox({
  mode,
  modelName,
  onSubmit,
  disabled,
  messageCount,
}: {
  mode: AppMode;
  modelName: string;
  onSubmit: (value: string) => void;
  disabled: boolean;
  messageCount: number;
}) {
  const borderColor = mode === "build" ? "blue" : "yellow";

  return (
    <Box
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      flexDirection="column"
    >
      <Text color="cyan">
        {modelName}
      </Text>
      <Box gap={1}>
        <Text color={borderColor} bold>
          ▸
        </Text>
        <TextInput
          key={messageCount}
          onSubmit={(value) => {
            if (value.trim() && !disabled) {
              onSubmit(value.trim());
            }
          }}
          placeholder={disabled ? "Waiting for response..." : "Type a message... (Tab to switch mode)"}
          isDisabled={disabled}
        />
      </Box>
    </Box>
  );
}
