import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ToolDefinition } from "../api/tools.js";
import { resolveToolPath } from "./path.js";

export const writeTool: ToolDefinition = {
  name: "write",
  description: "Write content to a file. Creates parent directories if needed.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Absolute or relative file path" },
      content: { type: "string", description: "Content to write to the file" },
    },
    required: ["path", "content"],
  },
  async execute(args, context) {
    const path = resolveToolPath(args.path, context);
    const content = args.content as string;
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf-8");
    return `Wrote ${content.length} bytes to ${path}`;
  },
};
