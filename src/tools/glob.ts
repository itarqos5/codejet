import { readdir } from "node:fs/promises";
import { resolve, relative, join } from "node:path";
import type { ToolDefinition } from "../api/tools.js";

async function globMatch(dir: string, pattern: string, results: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      await globMatch(full, pattern, results);
    } else if (matchPattern(entry.name, pattern)) {
      results.push(full);
    }
  }
}

function matchPattern(name: string, pattern: string): boolean {
  const regex = new RegExp(
    "^" +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*/g, "{{GLOBSTAR}}")
        .replace(/\*/g, "[^/]*")
        .replace(/\?/g, "[^/]")
        .replace(/\{\{GLOBSTAR\}\}/g, ".*") +
      "$",
  );
  return regex.test(name);
}

export const globTool: ToolDefinition = {
  name: "glob",
  description:
    "Find files matching a glob pattern. Supports **, *, and ? wildcards. Skips node_modules and .git.",
  parameters: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Glob pattern (e.g. **/*.ts, src/**/*.tsx)" },
    },
    required: ["pattern"],
  },
  async execute(args, context) {
    const pattern = args.pattern as string;
    const root = context.directory ?? process.cwd();
    const results: string[] = [];
    await globMatch(root, pattern, results);
    if (results.length === 0) return "No files matched.";
    return results.map((p) => relative(root, p)).join("\n");
  },
};
