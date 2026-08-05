import React from "react";
import { Box, Text } from "ink";
import { COLOR, GLYPH } from "../theme.js";

/**
 * The aligned status row, matching the installer's layout exactly:
 *
 *     <glyph> <label>                                <value>
 *
 * Padding is computed as a string rather than expressed with flexbox on
 * purpose. Flex-based right alignment depends on ink measuring every child
 * correctly, and a single mismeasured cell shifts the whole right column. A
 * precomputed pad is exact, and it is trivially clamped to the available width
 * so a row can never wrap.
 */

const ELLIPSIS = "…";

export function Row({
  glyph,
  glyphColor = COLOR.muted,
  label,
  labelColor = COLOR.text,
  labelBold,
  value,
  valueColor = COLOR.muted,
  width,
  indent = 2,
}: {
  glyph: string;
  glyphColor?: string;
  label: string;
  labelColor?: string;
  labelBold?: boolean;
  value?: string;
  valueColor?: string;
  width: number;
  indent?: number;
}) {
  const pad = " ".repeat(indent);
  // glyph + single space
  const used = indent + 2;
  const labelBudget = Math.max(4, width - used);

  let shownLabel = label;
  if (shownLabel.length > labelBudget) {
    shownLabel = shownLabel.slice(0, Math.max(1, labelBudget - 1)) + ELLIPSIS;
  }

  let shownValue = value ?? "";
  let gap = 0;
  if (shownValue) {
    const room = width - used - shownLabel.length - 2;
    if (room <= ELLIPSIS.length) {
      shownValue = "";
    } else {
      if (shownValue.length > room) {
        shownValue = shownValue.slice(0, room - ELLIPSIS.length) + ELLIPSIS;
      }
      gap = Math.max(1, width - used - shownLabel.length - shownValue.length);
    }
  }

  return (
    <Box width={width}>
      <Text wrap="truncate-end">
        <Text>{pad}</Text>
        <Text color={glyphColor}>{glyph}</Text>
        <Text> </Text>
        <Text color={labelColor} bold={labelBold}>
          {shownLabel}
        </Text>
        {shownValue ? (
          <>
            <Text>{" ".repeat(gap)}</Text>
            <Text color={valueColor}>{shownValue}</Text>
          </>
        ) : null}
      </Text>
    </Box>
  );
}

/** Section heading, as used by the installer: `• Title`. */
export function Section({ title, width }: { title: string; width: number }) {
  return (
    <Row
      glyph={GLYPH.bullet}
      glyphColor={COLOR.accent}
      label={title}
      labelColor={COLOR.text}
      labelBold
      width={width}
      indent={0}
    />
  );
}

/** Indented secondary line, for detail under a row. */
export function Note({
  text,
  width,
  indent = 6,
  color = COLOR.muted,
}: {
  text: string;
  width: number;
  indent?: number;
  color?: string;
}) {
  const budget = Math.max(4, width - indent);
  const shown = text.length > budget ? text.slice(0, budget - 1) + ELLIPSIS : text;
  return (
    <Box width={width}>
      <Text wrap="truncate-end" color={color} dimColor>
        {" ".repeat(indent)}
        {shown}
      </Text>
    </Box>
  );
}
