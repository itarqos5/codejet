import { unlink } from "node:fs/promises";
import type { ToolDefinition } from "../api/tools.js";

export const deleteFileTool: ToolDefinition = {
  name: "delete_file",
  description: "Delete a file.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path to delete" },
    },
    required: ["path"],
  },
  async execute(args) {
    const path = args.path as string;
    await unlink(path);
    return `Deleted ${path}`;
  },
};
