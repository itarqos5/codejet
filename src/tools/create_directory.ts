import { mkdir } from "node:fs/promises";
import type { ToolDefinition } from "../api/tools.js";

export const createDirectoryTool: ToolDefinition = {
  name: "create_directory",
  description: "Create a directory. Creates nested directories if needed.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Directory path to create" },
    },
    required: ["path"],
  },
  async execute(args) {
    const path = args.path as string;
    await mkdir(path, { recursive: true });
    return `Created directory ${path}`;
  },
};
