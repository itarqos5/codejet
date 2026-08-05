import { mkdir } from "node:fs/promises";
import type { ToolDefinition } from "../api/tools.js";
import { resolveToolPath } from "./path.js";

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
  async execute(args, context) {
    const path = resolveToolPath(args.path, context);
    await mkdir(path, { recursive: true });
    return `Created directory ${path}`;
  },
};
