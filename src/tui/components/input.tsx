import React, { useState } from "react";
import { Box, Text } from "ink";
import { TextInput } from "@inkjs/ui";
import type { AppMode } from "../state.js";

export function InputBox({
  mode,
  onSubmit,
  onFocus,
  disabled,
}: {
  mode: AppMode;
  onSubmit: (value: string) => void;
  onFocus: () => void;
  disabled: boolean;
}) {
  const borderColor = mode === "build" ? "blue" : "orange";

  return (
    <Box
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      flexDirection="column"
    >
      <Box gap={1}>
        <Text color={borderColor} bold>
          ▸
        </Text>
        <TextInput
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
