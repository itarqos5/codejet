import { readFile } from "node:fs/promises";
import type { ToolDefinition } from "../api/tools.js";

export const readTool: ToolDefinition = {
  name: "read",
  description: "Read a file and return its content with line numbers.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path to read" },
    },
    required: ["path"],
  },
  async execute(args) {
    const path = args.path as string;
    const raw = await readFile(path, "utf-8");
    const lines = raw.split("\n");
    const numbered = lines
      .map((line, i) => `${String(i + 1).padStart(4)}: ${line}`)
      .join("\n");
    return numbered;
  },
};
