import { readFileSync } from "node:fs";
import { join } from "node:path";

const pkg = JSON.parse(readFileSync(join(import.meta.dirname, "../../package.json"), "utf-8"));
export const VERSION: string = pkg.version;

export interface FreeModel {
  id: string;
  name: string;
  provider: "kilo" | "opencode";
  maxContext: number;
}

export const FREE_MODELS: FreeModel[] = [
  // Kilo Code free models
  { id: "nvidia/nemotron-ultra-253b", name: "Nemotron 3 Ultra", provider: "kilo", maxContext: 131072 },
  { id: "nvidia/nemotron-super-49b-v1", name: "Nemotron 3 Super", provider: "kilo", maxContext: 131072 },
  // OpenCode free models
  { id: "deepseek/deepseek-v4-flash-free", name: "Deepseek V4 Flash Free", provider: "opencode", maxContext: 131072 },
  { id: "moonshotai/mimo-v2.5-free", name: "MiMo V2.5 Free", provider: "opencode", maxContext: 131072 },
  { id: "openai/codex-mini", name: "Big Pickle", provider: "opencode", maxContext: 131072 },
];

export const DEFAULT_MODEL_ID = "openai/codex-mini";

export function getModelById(id: string): FreeModel | undefined {
  return FREE_MODELS.find((m) => m.id === id);
}

export function formatContextUsage(used: number, max: number): string {
  const kUsed = (used / 1000).toFixed(1);
  const pct = Math.round((used / max) * 100);
  return `${kUsed}K (${pct}%)`;
}
