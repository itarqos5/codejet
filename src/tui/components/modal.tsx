import React from "react";
import { Box, Text } from "ink";
import { OPENCODE_MODELS, KILO_MODELS, type FreeModel } from "../models.js";

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
  { label: "Check for Updates", description: "Check for a new version of CodeJet", action: "check-update" },
];

interface SelectableItem {
  type: "header" | "model";
  label: string;
  model?: FreeModel;
}

function buildModelItems(): SelectableItem[] {
  const items: SelectableItem[] = [];
  items.push({ type: "header", label: "OpenCode Models" });
  for (const m of OPENCODE_MODELS) {
    items.push({ type: "model", label: m.name, model: m });
  }
  items.push({ type: "header", label: "KiloCode Models" });
  for (const m of KILO_MODELS) {
    items.push({ type: "model", label: m.name, model: m });
  }
  return items;
}

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

  const rows = process.stdout.rows ?? 24;
  const topPad = Math.max(0, Math.floor((rows - COMMANDS.length - 6) / 2));

  return (
    <Box flexDirection="column" width="100%" height="100%">
      {Array.from({ length: topPad }).map((_, i) => (
        <Text key={i}>{" "}</Text>
      ))}
      <Box flexDirection="column" alignItems="center">
        <Box
          flexDirection="column"
          borderStyle="double"
          borderColor="cyan"
          paddingX={2}
          paddingTop={1}
          paddingBottom={1}
          width="70%"
        >
          <Box justifyContent="center" paddingBottom={1}>
            <Text color="cyan" bold>
              ⌘ Commands
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
      </Box>
    </Box>
  );
}

export function ModelSelector({
  visible,
  selectedIndex,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedIndex: number;
  onSelect: (modelId: string, provider: "opencode" | "kilo") => void;
  onClose: () => void;
}) {
  if (!visible) return null;

  const items = buildModelItems();
  const selectableIndices = items.map((_it, i) => i).filter((i) => items[i].type === "model");
  const clampedSelected = Math.min(selectedIndex, selectableIndices.length - 1);
  const selectedItemIdx = selectableIndices[clampedSelected] ?? 0;

  const rows = process.stdout.rows ?? 24;
  const topPad = Math.max(0, Math.floor((rows - items.length - 6) / 2));

  return (
    <Box flexDirection="column" width="100%" height="100%">
      {Array.from({ length: topPad }).map((_, i) => (
        <Text key={i}>{" "}</Text>
      ))}
      <Box flexDirection="column" alignItems="center">
        <Box
          flexDirection="column"
          borderStyle="double"
          borderColor="yellow"
          paddingX={2}
          paddingTop={1}
          paddingBottom={1}
          width="70%"
        >
          <Box justifyContent="center" paddingBottom={1}>
            <Text color="yellow" bold>
              ⌘ Select Model
            </Text>
          </Box>
          {items.map((item, i) => {
            if (item.type === "header") {
              return (
                <Box key={item.label} paddingX={1} marginTop={i > 0 ? 1 : 0}>
                  <Text color="yellow" bold>
                    {item.label}
                  </Text>
                </Box>
              );
            }
            const isCurrentlySelected = i === selectedItemIdx;
            return (
              <Box key={item.model!.id} gap={1} paddingX={1}>
                <Text color={isCurrentlySelected ? "yellow" : "gray"}>
                  {isCurrentlySelected ? "▸" : " "}
                </Text>
                <Text color={isCurrentlySelected ? "white" : "gray"} bold={isCurrentlySelected}>
                  {item.label}
                </Text>
                <Text color="gray" dimColor>
                  {" "}
                  ({item.model!.provider === "opencode" ? "opencode" : "free"})
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
      </Box>
    </Box>
  );
}

export { buildModelItems, type SelectableItem };
