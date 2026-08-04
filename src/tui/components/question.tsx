import React, { useState } from "react";
import { Box, Text } from "ink";
import { TextInput } from "@inkjs/ui";
import type { PendingQuestion } from "../state.js";

export function QuestionPrompt({
  question,
  onAnswer,
}: {
  question: PendingQuestion;
  onAnswer: (answer: string) => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const hasOptions = question.options && question.options.length > 0;

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="yellow"
      padding={1}
      gap={1}
    >
      <Text color="yellow" bold>
        ? {question.question}
      </Text>
      {hasOptions ? (
        <Box flexDirection="column" paddingLeft={2}>
          {question.options!.map((opt, i) => (
            <Box key={i} gap={1}>
              <Text color={i === selectedIndex ? "yellow" : "gray"}>
                {i === selectedIndex ? "▸" : " "}
              </Text>
              <Text color={i === selectedIndex ? "white" : "gray"} bold={i === selectedIndex}>
                {opt}
              </Text>
            </Box>
          ))}
          <Box paddingTop={1}>
            <Text color="gray" dimColor>
              ↑↓ select • Enter confirm
            </Text>
          </Box>
        </Box>
      ) : (
        <Box paddingLeft={2}>
          <TextInput
            onSubmit={(value) => {
              if (value.trim()) onAnswer(value.trim());
            }}
            placeholder="Type your answer..."
          />
        </Box>
      )}
    </Box>
  );
}
