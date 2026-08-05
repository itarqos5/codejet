import { readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import type { ToolDefinition } from "../api/tools.js";

const MAX_RESULTS = 500;

function globToRegExp(pattern: string): RegExp {
  const normalized = pattern.replace(/\\/g, "/").replace(/^\.\//, "");
  let source = "^";

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];

    if (char === "*") {
      if (normalized[i + 1] === "*") {
        if (normalized[i + 2] === "/") {
          source += "(?:.*/)?";
          i += 2;
        } else {
          source += ".*";
          i += 1;
        }
      } else {
        source += "[^/]*";
      }
      continue;
    }

    if (char === "?") {
      source += "[^/]";
      continue;
    }

    source += /[\\^$.*+?()[\]{}|]/.test(char) ? `\\${char}` : char;
  }

  return new RegExp(source + "$");
}

async function collectMatches(
  root: string,
  directory: string,
  pattern: RegExp,
  matchRelativePath: boolean,
  results: string[],
  abort?: AbortSignal,
): Promise<void> {
  if (abort?.aborted || results.length >= MAX_RESULTS) return;

  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (abort?.aborted || results.length >= MAX_RESULTS) return;

    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      await collectMatches(root, full, pattern, matchRelativePath, results, abort);
      continue;
    }

    const relativePath = relative(root, full).replace(/\\/g, "/");
    const candidate = matchRelativePath ? relativePath : entry.name;
    if (pattern.test(candidate)) results.push(relativePath);
  }
}

export const globTool: ToolDefinition = {
  name: "glob",
  description:
    "Find files matching a glob pattern. Supports **, *, and ? wildcards. Skips node_modules and .git.",
  parameters: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Glob pattern (e.g. **/*.ts, src/**/*.tsx)" },
      path: {
        type: "string",
        description: "Directory to search from (defaults to the agent workspace)",
      },
    },
    required: ["pattern"],
  },
  async execute(args, context) {
    const rawPattern = args.pattern as string;
    const normalizedPattern = rawPattern.replace(/\\/g, "/").replace(/^\.\//, "");
    const base = context.directory ?? process.cwd();
    const root =
      typeof args.path === "string" && args.path.trim()
        ? resolve(base, args.path)
        : base;
    const results: string[] = [];

    await collectMatches(
      root,
      root,
      globToRegExp(normalizedPattern),
      normalizedPattern.includes("/"),
      results,
      context.abort,
    );

    if (context.abort?.aborted) throw new Error("Glob search aborted");
    if (results.length === 0) return "No files matched.";

    results.sort();
    const suffix =
      results.length >= MAX_RESULTS
        ? `\n\nResults truncated at ${MAX_RESULTS} files.`
        : "";
    return results.join("\n") + suffix;
  },
};
