import { readFile, writeFile } from "node:fs/promises";
import type { ToolDefinition } from "../api/tools.js";
import { resolveToolPath } from "./path.js";

export const editTool: ToolDefinition = {
  name: "edit",
  description:
    "Replace lines in a file. Specify line range (from/to, 1-indexed inclusive) and the replacement content.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path" },
      from: { type: "number", description: "Start line number (1-indexed)" },
      to: { type: "number", description: "End line number (1-indexed, inclusive)" },
      content: { type: "string", description: "Replacement content for the specified line range" },
    },
    required: ["path", "from", "to", "content"],
  },
  async execute(args, context) {
    const path = resolveToolPath(args.path, context);
    const from = args.from as number;
    const to = args.to as number;
    const content = args.content as string;

    const raw = await readFile(path, "utf-8");
    const lines = raw.split("\n");

    if (from < 1 || to < from || from > lines.length) {
      return `Error: invalid line range ${from}-${to} (file has ${lines.length} lines)`;
    }

    const before = lines.slice(0, from - 1);
    const after = lines.slice(to);
    const result = [...before, content, ...after].join("\n");

    await writeFile(path, result, "utf-8");
    return `Replaced lines ${from}-${to} in ${path}`;
  },
};
