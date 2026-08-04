import React from "react";
import { Box, Text } from "ink";

interface ModalOption {
  label: string;
  description: string;
  action: string;
}

const COMMANDS: ModalOption[] = [
  { label: "New Conversation", description: "Start a fresh chat session", action: "new" },
  { label: "Switch Model", description: "Choose a different AI model", action: "model" },
  { label: "Compact Conversation", description: "Summarize and compress chat history", action: "compact" },
  { label: "Show Todos", description: "View and manage your todo list", action: "todos" },
  { label: "Clear History", description: "Clear all messages", action: "clear" },
];

export function CommandModal({
  visible,
  selectedIndex,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedIndex: number;
  onSelect: (action: string) => void;
  onClose: () => void;
}) {
  if (!visible) return null;

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="cyan"
      paddingX={1}
    >
      <Box justifyContent="center" paddingBottom={1}>
        <Text color="cyan" bold>
          Commands
        </Text>
      </Box>
      {COMMANDS.map((cmd, i) => {
        const isSelected = i === selectedIndex;
        return (
          <Box key={cmd.action} gap={1} paddingX={1}>
            <Text color={isSelected ? "cyan" : "gray"}>
              {isSelected ? "▸" : " "}
            </Text>
            <Text color={isSelected ? "white" : "gray"} bold={isSelected}>
              {cmd.label}
            </Text>
            <Text color="gray" dimColor>
              {" "}
              {cmd.description}
            </Text>
          </Box>
        );
      })}
      <Box justifyContent="center" paddingTop={1}>
        <Text color="gray" dimColor>
          ↑↓ navigate • Enter select • Esc close
        </Text>
      </Box>
    </Box>
  );
}

export function ModelSelector({
  visible,
  models,
  selectedIndex,
  onSelect,
  onClose,
}: {
  visible: boolean;
  models: { id: string; name: string; provider: string }[];
  selectedIndex: number;
  onSelect: (modelId: string) => void;
  onClose: () => void;
}) {
  if (!visible) return null;

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="yellow"
      paddingX={1}
    >
      <Box justifyContent="center" paddingBottom={1}>
        <Text color="yellow" bold>
          Select Model
        </Text>
      </Box>
      {models.map((model, i) => {
        const isSelected = i === selectedIndex;
        return (
          <Box key={model.id} gap={1} paddingX={1}>
            <Text color={isSelected ? "yellow" : "gray"}>
              {isSelected ? "▸" : " "}
            </Text>
            <Text color={isSelected ? "white" : "gray"} bold={isSelected}>
              {model.name}
            </Text>
            <Text color="gray" dimColor>
              {" "}
              ({model.provider})
            </Text>
          </Box>
        );
      })}
      <Box justifyContent="center" paddingTop={1}>
        <Text color="gray" dimColor>
          ↑↓ navigate • Enter select • Esc close
        </Text>
      </Box>
    </Box>
  );
}
