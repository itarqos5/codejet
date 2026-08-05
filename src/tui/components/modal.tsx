import React from "react";
import { Box, Text } from "ink";
import { COLOR, GLYPH, truncate } from "../theme.js";
import { OPENCODE_MODELS, KILO_MODELS, type FreeModel } from "../models.js";

/**
 * Command and model palettes.
 *
 * These are rendered inline, directly above the prompt, as a normal part of the
 * flex column. The previous implementation used `position="absolute"` boxes
 * sized to the whole screen plus hand-computed padding rows, which ink drew on
 * top of the transcript — the source of the overlapping frames.
 *
 * Long lists are windowed so the panel can never be taller than the space the
 * caller reserved for it.
 */

export interface PaletteItem {
  /** Non-selectable group label. */
  header?: boolean;
  label: string;
  description?: string;
}

export interface CommandItem extends PaletteItem {
  action: string;
}

export const COMMANDS: CommandItem[] = [
  { label: "New session", description: "Clear the transcript and start fresh", action: "new" },
  { label: "Switch model", description: "Choose a different model", action: "model" },
  { label: "Show todos", description: "Reload the todo list", action: "todos" },
  { label: "Check for updates", description: "Look for a newer CodeJet", action: "check-update" },
  { label: "Quit", description: "Exit CodeJet", action: "quit" },
];

export interface SelectableItem {
  type: "header" | "model";
  label: string;
  model?: FreeModel;
}

export function buildModelItems(): SelectableItem[] {
  const items: SelectableItem[] = [];
  items.push({ type: "header", label: "OpenCode" });
  for (const m of OPENCODE_MODELS) items.push({ type: "model", label: m.name, model: m });
  items.push({ type: "header", label: "KiloCode" });
  for (const m of KILO_MODELS) items.push({ type: "model", label: m.name, model: m });
  return items;
}

/** Windows a list around the selection so it fits in `maxRows`. */
function windowItems<T>(items: T[], selected: number, maxRows: number): { slice: T[]; start: number } {
  if (items.length <= maxRows) return { slice: items, start: 0 };
  const half = Math.floor(maxRows / 2);
  const start = Math.max(0, Math.min(items.length - maxRows, selected - half));
  return { slice: items.slice(start, start + maxRows), start };
}

function PaletteFrame({
  title,
  width,
  children,
  footer,
}: {
  title: string;
  width: number;
  children: React.ReactNode;
  footer?: string;
}) {
  const inner = Math.max(8, width - 4);
  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle="round"
      borderColor={COLOR.accent}
      paddingX={1}
    >
      <Box width={inner}>
        <Text color={COLOR.accent} bold wrap="truncate-end">
          {truncate(title, inner)}
        </Text>
      </Box>
      {children}
      {footer && (
        <Box width={inner}>
          <Text color={COLOR.muted} dimColor wrap="truncate-end">
            {truncate(footer, inner)}
          </Text>
        </Box>
      )}
    </Box>
  );
}

function Row({
  selected,
  label,
  description,
  width,
  accent,
}: {
  selected: boolean;
  label: string;
  description?: string;
  width: number;
  accent: string;
}) {
  const marker = selected ? GLYPH.selected : " ";
  const labelWidth = label.length;
  const descBudget = Math.max(0, width - labelWidth - 4);

  return (
    <Box width={width} flexDirection="row">
      <Text wrap="truncate-end">
        <Text color={selected ? accent : COLOR.muted}>{marker} </Text>
        <Text color={selected ? COLOR.text : COLOR.textDim} bold={selected}>
          {label}
        </Text>
        {description && descBudget > 4 ? (
          <Text color={COLOR.muted} dimColor>
            {"  "}
            {truncate(description, descBudget)}
          </Text>
        ) : null}
      </Text>
    </Box>
  );
}

export function CommandPalette({
  selectedIndex,
  width,
  maxRows = 8,
}: {
  selectedIndex: number;
  width: number;
  maxRows?: number;
}) {
  const inner = Math.max(8, width - 4);
  const { slice, start } = windowItems(COMMANDS, selectedIndex, maxRows);

  return (
    <PaletteFrame title="Commands" width={width} footer="↑↓ move   ↵ select   esc close">
      {slice.map((cmd, i) => (
        <Row
          key={cmd.action}
          selected={start + i === selectedIndex}
          label={cmd.label}
          description={cmd.description}
          width={inner}
          accent={COLOR.accent}
        />
      ))}
    </PaletteFrame>
  );
}

export function ModelPalette({
  selectedIndex,
  currentModelId,
  width,
  maxRows = 12,
}: {
  /** Index into the selectable (model-only) subset. */
  selectedIndex: number;
  currentModelId: string;
  width: number;
  maxRows?: number;
}) {
  const inner = Math.max(8, width - 4);
  const items = buildModelItems();
  const selectableIndices = items.map((_, i) => i).filter((i) => items[i].type === "model");
  const clamped = Math.max(0, Math.min(selectedIndex, selectableIndices.length - 1));
  const activeItemIndex = selectableIndices[clamped] ?? 0;

  const { slice, start } = windowItems(items, activeItemIndex, maxRows);

  return (
    <PaletteFrame title="Select model" width={width} footer="↑↓ move   ↵ select   esc close">
      {slice.map((item, i) => {
        const absolute = start + i;
        if (item.type === "header") {
          return (
            <Box key={`h-${item.label}`} width={inner}>
              <Text color={COLOR.muted} dimColor bold wrap="truncate-end">
                {item.label}
              </Text>
            </Box>
          );
        }
        const isCurrent = item.model?.id === currentModelId;
        return (
          <Row
            key={item.model!.id}
            selected={absolute === activeItemIndex}
            label={item.label}
            description={isCurrent ? "current" : undefined}
            width={inner}
            accent={COLOR.accent}
          />
        );
      })}
    </PaletteFrame>
  );
}
