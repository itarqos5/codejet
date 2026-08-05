import { resolve } from "node:path";
import type { ToolContext } from "../api/tools.js";

export function resolveToolPath(
  value: unknown,
  context: ToolContext,
  fallback?: string,
): string {
  const base = context.directory ?? process.cwd();
  if (typeof value === "string" && value.trim()) {
    return resolve(base, value);
  }
  if (fallback === undefined) {
    throw new Error("The `path` parameter is required");
  }
  const input = fallback;
  return resolve(base, input);
}
