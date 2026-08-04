import React from "react";
import { Box, Text } from "ink";
import type { Todo } from "../../tools/todo.js";

export function TodoPanel({ todos }: { todos: Todo[] }) {
  if (todos.length === 0) return null;

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="green" paddingX={1} width={35}>
      <Text color="green" bold>
        ☑ Todos
      </Text>
      {todos.map((todo) => (
        <Box key={todo.id} gap={1}>
          <Text color={todo.done ? "green" : "gray"}>
            {todo.done ? "✓" : "○"}
          </Text>
          <Text
            color={todo.done ? "gray" : "white"}
            strikethrough={todo.done}
            dimColor={todo.done}
          >
            #{todo.id} {todo.text}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
