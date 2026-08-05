import { rm } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type { ToolDefinition } from "../api/tools.js";
import { resolveToolPath } from "./path.js";

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
  async execute(args, context) {
    const workspace = resolve(context.directory ?? process.cwd());
    const path = resolveToolPath(args.path, context);
    const relativePath = relative(workspace, path);
    const outsideWorkspace =
      relativePath.startsWith("..") || isAbsolute(relativePath);

    if (!relativePath || outsideWorkspace) {
      throw new Error(
        "Recursive deletion is limited to directories inside the agent workspace",
      );
    }

    await rm(path, { recursive: true, force: false });
    return `Deleted directory ${path}`;
  },
};
