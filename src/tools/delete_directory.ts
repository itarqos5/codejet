import { rm } from "node:fs/promises";
import type { ToolDefinition } from "../api/tools.js";

export const deleteDirectoryTool: ToolDefinition = {
  name: "delete_directory",
  description: "Delete a directory and all its contents.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Directory path to delete" },
    },
    required: ["path"],
  },
  async execute(args) {
    const path = args.path as string;
    await rm(path, { recursive: true, force: true });
    return `Deleted directory ${path}`;
  },
};
