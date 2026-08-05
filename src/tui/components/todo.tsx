import React from "react";
import { Box, Text } from "ink";
import { COLOR, GLYPH, truncate } from "../theme.js";
import type { Todo } from "../../tools/todo.js";

/**
 * Todo list, rendered inline above the prompt.
 *
 * It used to be a fixed 35-column side panel next to the transcript, which
 * stole width from the message area without the message area knowing, so text
 * was laid out for one width and drawn in another.
 */
export function TodoPanel({
  todos,
  width,
  maxRows = 6,
}: {
  todos: Todo[];
  width: number;
  maxRows?: number;
}) {
  if (todos.length === 0) return null;

  const inner = Math.max(8, width - 4);
  const pending = todos.filter((t) => !t.done).length;
  const visible = todos.slice(0, maxRows);
  const hidden = todos.length - visible.length;

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle="round"
      borderColor={COLOR.border}
      paddingX={1}
    >
      <Box width={inner}>
        <Text color={COLOR.success} bold wrap="truncate-end">
          Todos{" "}
          <Text color={COLOR.muted} dimColor>
            {todos.length - pending}/{todos.length}
          </Text>
        </Text>
      </Box>

      {visible.map((todo) => (
        <Text key={todo.id} wrap="truncate-end">
          <Text color={todo.done ? COLOR.success : COLOR.muted}>
            {todo.done ? GLYPH.check : GLYPH.uncheck}{" "}
          </Text>
          <Text
            color={todo.done ? COLOR.muted : COLOR.text}
            strikethrough={todo.done}
            dimColor={todo.done}
          >
            {truncate(todo.text, inner - 3)}
          </Text>
        </Text>
      ))}

      {hidden > 0 && (
        <Text color={COLOR.muted} dimColor wrap="truncate-end">
          +{hidden} more
        </Text>
      )}
    </Box>
  );
}
