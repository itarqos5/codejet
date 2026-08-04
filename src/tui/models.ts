import { readFileSync } from "node:fs";
import { join } from "node:path";

const pkg = JSON.parse(readFileSync(join(import.meta.dirname, "../../package.json"), "utf-8"));
export const VERSION: string = pkg.version;

export type ModelProvider = "opencode" | "kilo";

export interface FreeModel {
  id: string;
  name: string;
  provider: ModelProvider;
  maxContext: number;
}

export const OPENCODE_MODELS: FreeModel[] = [
  { id: "opencode/big-pickle", name: "Big Pickle", provider: "opencode", maxContext: 131072 },
  { id: "opencode/deepseek-v4-flash-free", name: "Deepseek V4 Flash Free", provider: "opencode", maxContext: 131072 },
  { id: "opencode/mimo-v2.5-free", name: "MiMo V2.5 Free", provider: "opencode", maxContext: 131072 },
  { id: "opencode/nemotron-3-ultra-free", name: "Nemotron 3 Ultra Free", provider: "opencode", maxContext: 131072 },
  { id: "opencode/north-mini-code-free", name: "North Mini Code Free", provider: "opencode", maxContext: 131072 },
  { id: "opencode/laguna-s-2.1-free", name: "Laguna S 2.1 Free", provider: "opencode", maxContext: 131072 },
  { id: "opencode/ling-3.0-flash-free", name: "Ling 3.0 Flash Free", provider: "opencode", maxContext: 131072 },
  { id: "opencode/gpt-5.4-mini", name: "GPT-5.4 Mini", provider: "opencode", maxContext: 131072 },
  { id: "opencode/gpt-5.4-nano", name: "GPT-5.4 Nano", provider: "opencode", maxContext: 131072 },
  { id: "opencode/gpt-5.5", name: "GPT-5.5", provider: "opencode", maxContext: 131072 },
  { id: "opencode/claude-sonnet-4-5", name: "Claude Sonnet 4.5", provider: "opencode", maxContext: 131072 },
  { id: "opencode/claude-opus-4-5", name: "Claude Opus 4.5", provider: "opencode", maxContext: 131072 },
  { id: "opencode/gemini-3.5-flash", name: "Gemini 3.5 Flash", provider: "opencode", maxContext: 131072 },
  { id: "opencode/glm-5", name: "GLM 5", provider: "opencode", maxContext: 131072 },
  { id: "opencode/grok-4.5", name: "Grok 4.5", provider: "opencode", maxContext: 131072 },
];

export const KILO_MODELS: FreeModel[] = [
  { id: "nvidia/nemotron-3-ultra-550b-a55b:free", name: "Nemotron 3 Ultra", provider: "kilo", maxContext: 1000000 },
  { id: "nvidia/nemotron-3-super-120b-a12b:free", name: "Nemotron 3 Super", provider: "kilo", maxContext: 262144 },
  { id: "inclusionai/ling-3.0-flash:free", name: "Ling 3.0 Flash", provider: "kilo", maxContext: 262144 },
  { id: "tencent/hy3:free", name: "Hy3", provider: "kilo", maxContext: 262144 },
  { id: "inclusionai/ring-2.6-1t:free", name: "Ring 2.6 1T", provider: "kilo", maxContext: 262144 },
  { id: "inclusionai/ling-2.6-flash:free", name: "Ling 2.6 Flash", provider: "kilo", maxContext: 262144 },
  { id: "poolside/laguna-s-2.1:free", name: "Laguna S 2.1", provider: "kilo", maxContext: 262144 },
  { id: "google/gemma-4-26b-a4b-it:free", name: "Gemma 4 26B", provider: "kilo", maxContext: 262144 },
  { id: "tencent/hy3-preview:free", name: "Hy3 Preview", provider: "kilo", maxContext: 262144 },
  { id: "inclusionai/ling-2.6-1t:free", name: "Ling 2.6 1T", provider: "kilo", maxContext: 262144 },
  { id: "nex-agi/nex-n2-pro:free", name: "Nex N2 Pro", provider: "kilo", maxContext: 262144 },
  { id: "kilo/openrouter/free", name: "Auto Free Router", provider: "kilo", maxContext: 200000 },
  { id: "kilo/kilo-auto/free", name: "Kilo Auto Free", provider: "kilo", maxContext: 205000 },
];

export const ALL_MODELS: FreeModel[] = [...OPENCODE_MODELS, ...KILO_MODELS];

export const DEFAULT_MODEL_ID = "opencode/big-pickle";

export function getModelById(id: string): FreeModel | undefined {
  return ALL_MODELS.find((m) => m.id === id);
}

export function getModelProvider(id: string): ModelProvider {
  const model = getModelById(id);
  return model?.provider ?? (id.startsWith("opencode/") ? "opencode" : "kilo");
}

export function formatContextUsage(used: number, max: number): string {
  const kUsed = (used / 1000).toFixed(1);
  const pct = Math.round((used / max) * 100);
  return `${kUsed}K (${pct}%)`;
}
