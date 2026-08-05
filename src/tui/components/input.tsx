import React, { useCallback, useState } from "react";
import { Box, Text, useInput } from "ink";
import { COLOR, GLYPH } from "../theme.js";
import type { AppMode } from "../state.js";

/**
 * The prompt.
 *
 * Written from scratch rather than using a component library so the cursor,
 * editing keys and paste behaviour are all under our control and the box can be
 * given an exact width. The previous version relied on a third-party input plus
 * a 500ms blink interval, which re-rendered the whole tree twice a second while
 * output was streaming.
 *
 * Layout invariant: the bordered box is exactly `width` cells wide, and its
 * inner text is `width - 4` (two border cells, two padding cells). Nothing is
 * ever allowed to reach the terminal edge.
 */

/** Maximum wrapped rows the prompt may occupy before it windows the text. */
const MAX_ROWS = 6;

function stripControl(input: string): string {
  // Mouse-wheel/selection reporting arrives as ANSI CSI or OSC sequences.
  // Removing only ESC leaves printable fragments such as "[<...M" in input.
  const withoutAnsi = input
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, "")
    // Ink may have already removed ESC while decoding an unknown mouse event.
    .replace(/\[<\d+;\d+;\d+[mM]/g, "");
  // eslint-disable-next-line no-control-regex
  return withoutAnsi.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

function deleteWordLeft(value: string, cursor: number): { value: string; cursor: number } {
  if (cursor === 0) return { value, cursor };
  let i = cursor;
  while (i > 0 && /\s/.test(value[i - 1])) i--;
  while (i > 0 && !/\s/.test(value[i - 1])) i--;
  return { value: value.slice(0, i) + value.slice(cursor), cursor: i };
}

export function PromptInput({
  mode,
  disabled,
  busy,
  width,
  onSubmit,
}: {
  mode: AppMode;
  /** Input is not accepting keys (modal open, question pending). */
  disabled: boolean;
  /** A request is in flight; typing is allowed but submit is blocked. */
  busy: boolean;
  width: number;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const [cursor, setCursor] = useState(0);

  const accent = mode === "build" ? COLOR.accent : COLOR.warning;
  const contentWidth = Math.max(8, width - 4);

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    setValue("");
    setCursor(0);
    onSubmit(trimmed);
  }, [value, busy, onSubmit]);

  useInput(
    (input, key) => {
      if (key.return) {
        submit();
        return;
      }

      if (key.leftArrow) {
        setCursor((c) => Math.max(0, c - 1));
        return;
      }
      if (key.rightArrow) {
        setCursor((c) => Math.min(value.length, c + 1));
        return;
      }

      // Backspace and Delete both remove the character to the left: on Windows
      // terminals ink reports the backspace key inconsistently between the two.
      if (key.backspace || key.delete) {
        if (cursor > 0) {
          setValue(value.slice(0, cursor - 1) + value.slice(cursor));
          setCursor(cursor - 1);
        }
        return;
      }

      if (key.ctrl) {
        switch (input) {
          case "a":
            setCursor(0);
            return;
          case "e":
            setCursor(value.length);
            return;
          case "u":
            setValue(value.slice(cursor));
            setCursor(0);
            return;
          case "k":
            setValue(value.slice(0, cursor));
            return;
          case "w": {
            const next = deleteWordLeft(value, cursor);
            setValue(next.value);
            setCursor(next.cursor);
            return;
          }
          default:
            // Other ctrl combos belong to the global handler.
            return;
        }
      }

      if (key.escape || key.tab) return;

      // Printable input. A paste arrives as one chunk, so this handles it too.
      const text = stripControl(input);
      if (!text) return;
      setValue(value.slice(0, cursor) + text + value.slice(cursor));
      setCursor(cursor + text.length);
    },
    { isActive: !disabled },
  );

  // Keep the prompt from growing without bound: window the text around the
  // cursor once it would exceed MAX_ROWS wrapped rows.
  const budget = contentWidth * MAX_ROWS;
  let display = value;
  let displayCursor = cursor;
  if (value.length > budget) {
    const start = Math.max(0, Math.min(value.length - budget, cursor - Math.floor(budget / 2)));
    display = value.slice(start, start + budget);
    displayCursor = cursor - start;
  }

  const before = display.slice(0, displayCursor);
  const atCursor = display.slice(displayCursor, displayCursor + 1) || " ";
  const after = display.slice(displayCursor + 1);

  const placeholder = busy
    ? "Working… type your next message or press esc to interrupt"
    : mode === "plan"
      ? "Describe what you want planned"
      : "Ask, edit, or describe a change";

  return (
    <Box flexDirection="column" width={width}>
      <Box
        width={width}
        borderStyle="round"
        borderColor={disabled ? COLOR.border : accent}
        borderDimColor={disabled}
        paddingX={1}
      >
        <Box width={contentWidth} flexDirection="row">
          <Text color={accent} bold>
            {GLYPH.prompt}{" "}
          </Text>
          <Box width={Math.max(4, contentWidth - 2)}>
            {value.length === 0 ? (
              <Text wrap="truncate-end">
                {!disabled && <Text inverse> </Text>}
                <Text color={COLOR.muted} dimColor>
                  {placeholder}
                </Text>
              </Text>
            ) : (
              <Text wrap="wrap" color={COLOR.text}>
                {before}
                {disabled ? atCursor : <Text inverse>{atCursor}</Text>}
                {after}
              </Text>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
