import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { ToolDefinition } from "../api/tools.js";

export const listTool: ToolDefinition = {
  name: "list",
  description: "List files and directories at a path. Shows type (file/dir) and size.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Directory path to list (defaults to cwd)",
      },
    },
  },
  async execute(args, context) {
    const target = (args.path as string) ?? context.directory ?? process.cwd();
    const entries = await readdir(target, { withFileTypes: true });
    const rows = await Promise.all(
      entries.map(async (entry) => {
        const full = join(target, entry.name);
        const isDir = entry.isDirectory();
        try {
          const s = await stat(full);
          const size = isDir ? "-" : formatSize(s.size);
          return `${isDir ? "dir " : "file"} ${size.padStart(8)} ${entry.name}`;
        } catch {
          return `${isDir ? "dir " : "file"}        ? ${entry.name}`;
        }
      }),
    );
    if (rows.length === 0) return "(empty directory)";
    return rows.join("\n");
  },
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}
