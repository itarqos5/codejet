import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { TextInput } from "@inkjs/ui";
import type { PendingQuestion } from "../state.js";

function AnimatedCursor() {
  const [show, setShow] = useState(true);
  
  useEffect(() => {
    const interval = setInterval(() => setShow((s) => !s), 400);
    return () => clearInterval(interval);
  }, []);
  
  return <Text color="yellow" bold>{show ? "▋" : " "}</Text>;
}

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
      {/* Question header */}
      <Box gap={1}>
        <Text color="yellow" bold>◆</Text>
        <Text color="yellow" bold>Question</Text>
      </Box>
      
      {/* Question text */}
      <Box paddingLeft={2}>
        <Text color="white">{question.question}</Text>
      </Box>
      
      <Box>
        <Text color="gray">{"─".repeat(30)}</Text>
      </Box>
      
      {hasOptions ? (
        <Box flexDirection="column" paddingLeft={2} gap={1}>
          {question.options!.map((opt, i) => (
            <Box key={i} gap={1} alignItems="center">
              <Text color={i === selectedIndex ? "yellow" : "gray"}>
                {i === selectedIndex ? "▸" : " "}
              </Text>
              <Text 
                color={i === selectedIndex ? "white" : "gray"} 
                bold={i === selectedIndex}
              >
                {i + 1}. {opt}
              </Text>
            </Box>
          ))}
          <Box paddingTop={1} gap={2}>
            <Text color="gray" dimColor>↑↓</Text>
            <Text color="gray" dimColor>select</Text>
            <Text color="gray">│</Text>
            <Text color="gray" dimColor>Enter</Text>
            <Text color="gray" dimColor>confirm</Text>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column" paddingLeft={2} gap={1}>
          <Box gap={1} alignItems="center">
            <AnimatedCursor />
            <TextInput
              onSubmit={(value) => {
                if (value.trim()) onAnswer(value.trim());
              }}
              placeholder="Type your answer..."
            />
          </Box>
          <Text color="gray" dimColor>Press Enter to submit</Text>
        </Box>
      )}
    </Box>
  );
}
