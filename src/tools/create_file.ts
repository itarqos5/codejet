import { writeFile } from "node:fs/promises";
import type { ToolDefinition } from "../api/tools.js";

export const createFileTool: ToolDefinition = {
  name: "create_file",
  description: "Create an empty file. Fails if the file already exists.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path to create" },
    },
    required: ["path"],
  },
  async execute(args) {
    const path = args.path as string;
    await writeFile(path, "", { flag: "wx" });
    return `Created ${path}`;
  },
};
