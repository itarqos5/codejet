import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import type { ToolDefinition } from "../api/tools.js";

const MAX_MATCHES = 50;

interface Match {
  file: string;
  line: number;
  text: string;
}

async function searchFile(
  file: string,
  pattern: RegExp,
  results: Match[],
  abort?: AbortSignal,
): Promise<void> {
  if (abort?.aborted || results.length >= MAX_MATCHES) return;

  try {
    const content = await readFile(file, "utf-8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (abort?.aborted || results.length >= MAX_MATCHES) return;
      if (pattern.test(lines[i])) {
        results.push({ file, line: i + 1, text: lines[i] });
      }
    }
  } catch {
    // Ignore unreadable and binary files.
  }
}

async function searchDirectory(
  directory: string,
  pattern: RegExp,
  results: Match[],
  abort?: AbortSignal,
): Promise<void> {
  if (abort?.aborted || results.length >= MAX_MATCHES) return;

  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (abort?.aborted || results.length >= MAX_MATCHES) return;

    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      await searchDirectory(full, pattern, results, abort);
    } else {
      await searchFile(full, pattern, results, abort);
    }
  }
}

export const grepTool: ToolDefinition = {
  name: "grep",
  description:
    "Search for a regex pattern in a file or directory. Returns matching lines with path and line number.",
  parameters: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Regex pattern to search for" },
      path: {
        type: "string",
        description: "Directory or file to search (defaults to the agent workspace)",
      },
    },
    required: ["pattern"],
  },
  async execute(args, context) {
    const pattern = new RegExp(args.pattern as string, "i");
    const base = context.directory ?? process.cwd();
    const target =
      typeof args.path === "string" && args.path.trim()
        ? resolve(base, args.path)
        : base;
    const targetStat = await stat(target);
    const results: Match[] = [];

    if (targetStat.isDirectory()) {
      await searchDirectory(target, pattern, results, context.abort);
    } else {
      await searchFile(target, pattern, results, context.abort);
    }

    if (context.abort?.aborted) throw new Error("Grep search aborted");
    if (results.length === 0) return "No matches found.";

    const output = results
      .map((match) => {
        const file = relative(base, match.file).replace(/\\/g, "/") || match.file;
        return `${file}:${match.line}: ${match.text.trim()}`;
      })
      .join("\n");
    const suffix =
      results.length >= MAX_MATCHES
        ? `\n\nResults truncated at ${MAX_MATCHES} matches.`
        : "";
    return output + suffix;
  },
};
