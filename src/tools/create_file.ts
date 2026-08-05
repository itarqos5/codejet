import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ToolDefinition } from "../api/tools.js";
import { resolveToolPath } from "./path.js";

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
  async execute(args, context) {
    const path = resolveToolPath(args.path, context);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, "", { flag: "wx" });
    return `Created ${path}`;
  },
};
