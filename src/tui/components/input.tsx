import React, { useState, useEffect, useRef } from "react";
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
  const [cursorPosition, setCursorPosition] = useState(0);
  const cursorRef = useRef<NodeJS.Timeout | null>(null);
  const [showCursor, setShowCursor] = useState(true);
  
  const borderColor = mode === "build" ? "blue" : "yellow";
  const modeLabel = mode === "build" ? "BUILD" : "PLAN";
  const modeBg = mode === "build" ? "#001a33" : "#332200";

  // Blinking cursor effect
  useEffect(() => {
    cursorRef.current = setInterval(() => {
      setShowCursor((s) => !s);
    }, 500);
    return () => {
      if (cursorRef.current) clearInterval(cursorRef.current);
    };
  }, []);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      paddingY={0}
    >
      {/* Mode indicator bar */}
      <Box gap={0}>
        <Text color={borderColor} bold>{modeLabel}</Text>
        <Text color="gray"> │ </Text>
        <Text color="cyan">{modelName}</Text>
        {disabled && (
          <>
            <Text color="gray"> │ </Text>
            <Text color="yellow" bold>⚡ Processing...</Text>
          </>
        )}
      </Box>
      
      {/* Input line with futuristic styling */}
      <Box gap={1} alignItems="center">
        <Text color={borderColor} bold>
          {showCursor ? "▸" : "›"}
        </Text>
        <TextInput
          key={messageCount}
          onSubmit={(value) => {
            if (value.trim() && !disabled) {
              onSubmit(value.trim());
            }
          }}
          placeholder={disabled ? "Waiting for model response..." : "Enter your request..."}
          isDisabled={disabled}
        />
      </Box>
      
      {/* Helper hints */}
      {!disabled && (
        <Box gap={2}>
          <Text color="gray" dimColor>Enter</Text>
          <Text color="gray" dimColor>send</Text>
          <Text color="gray">│</Text>
          <Text color="gray" dimColor>Tab</Text>
          <Text color="gray" dimColor>switch mode</Text>
          <Text color="gray">│</Text>
          <Text color="gray" dimColor>Ctrl+P</Text>
          <Text color="gray" dimColor>menu</Text>
        </Box>
      )}
    </Box>
  );
}
