import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { ToolDefinition } from "../api/tools.js";

const TODO_PATH = ".codejet/todos.json";

export interface Todo {
  id: number;
  text: string;
  done: boolean;
  created: number;
}

export async function loadTodos(): Promise<Todo[]> {
  try {
    const raw = await readFile(TODO_PATH, "utf-8");
    return JSON.parse(raw) as Todo[];
  } catch {
    return [];
  }
}

async function saveTodos(todos: Todo[]): Promise<void> {
  await mkdir(dirname(TODO_PATH), { recursive: true });
  await writeFile(TODO_PATH, JSON.stringify(todos, null, 2), "utf-8");
}

export const todoTool: ToolDefinition = {
  name: "todo",
  description: "Manage a session todo list. Actions: add, list, done, remove.",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["add", "list", "done", "remove"],
        description: "Todo action to perform",
      },
      text: { type: "string", description: "Todo text (required for add)" },
      id: { type: "number", description: "Todo ID (required for done/remove)" },
    },
    required: ["action"],
  },
  async execute(args) {
    const action = args.action as string;
    const todos = await loadTodos();

    switch (action) {
      case "add": {
        const text = args.text as string;
        if (!text) return "Error: text is required for add";
        const id = todos.length > 0 ? Math.max(...todos.map((t) => t.id)) + 1 : 1;
        todos.push({ id, text, done: false, created: Date.now() });
        await saveTodos(todos);
        return `Added todo #${id}: ${text}`;
      }

      case "list": {
        if (todos.length === 0) return "No todos.";
        return todos
          .map((t) => `${t.done ? "[x]" : "[ ]"} #${t.id}: ${t.text}`)
          .join("\n");
      }

      case "done": {
        const id = args.id as number;
        if (id == null) return "Error: id is required for done";
        const todo = todos.find((t) => t.id === id);
        if (!todo) return `Error: todo #${id} not found`;
        todo.done = true;
        await saveTodos(todos);
        return `Completed todo #${id}: ${todo.text}`;
      }

      case "remove": {
        const id = args.id as number;
        if (id == null) return "Error: id is required for remove";
        const idx = todos.findIndex((t) => t.id === id);
        if (idx === -1) return `Error: todo #${id} not found`;
        const [removed] = todos.splice(idx, 1);
        await saveTodos(todos);
        return `Removed todo #${id}: ${removed.text}`;
      }

      default:
        return `Error: unknown action "${action}". Use add, list, done, or remove.`;
    }
  },
};
