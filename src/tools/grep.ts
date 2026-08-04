import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { ToolDefinition } from "../api/tools.js";

interface Match {
  file: string;
  line: number;
  text: string;
}

async function searchDir(
  dir: string,
  pattern: RegExp,
  results: Match[],
): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      await searchDir(full, pattern, results);
    } else {
      try {
        const content = await readFile(full, "utf-8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (pattern.test(lines[i])) {
            results.push({ file: full, line: i + 1, text: lines[i] });
          }
        }
      } catch {
        // skip binary files
      }
    }
  }
}

export const grepTool: ToolDefinition = {
  name: "grep",
  description:
    "Search for a regex pattern in files. Returns matching lines with file path and line number.",
  parameters: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Regex pattern to search for" },
      path: {
        type: "string",
        description: "Directory or file to search in (defaults to cwd)",
      },
    },
    required: ["pattern"],
  },
  async execute(args, context) {
    const pattern = new RegExp(args.pattern as string, "i");
    const searchPath = (args.path as string) ?? context.directory ?? process.cwd();
    const results: Match[] = [];
    await searchDir(searchPath, pattern, results);
    if (results.length === 0) return "No matches found.";
    return results
      .slice(0, 50)
      .map((m) => `${m.file}:${m.line}: ${m.text.trim()}`)
      .join("\n");
  },
};
