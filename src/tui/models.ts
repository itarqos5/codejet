import { VERSION } from "../api/updater.js";

export { VERSION };

export type ModelProvider = "opencode" | "kilo";

export interface FreeModel {
  id: string;
  name: string;
  provider: ModelProvider;
  maxContext: number;
}

export const OPENCODE_MODELS: FreeModel[] = [
  { id: "opencode/big-pickle", name: "Big Pickle", provider: "opencode", maxContext: 200000 },
  { id: "opencode/grok-code", name: "Grok Code Fast 1", provider: "opencode", maxContext: 256000 },
  { id: "opencode/deepseek-v4-flash-free", name: "DeepSeek V4 Flash", provider: "opencode", maxContext: 200000 },
  { id: "opencode/mimo-v2.5-free", name: "MiMo V2.5", provider: "opencode", maxContext: 200000 },
  { id: "opencode/mimo-v2-pro-free", name: "MiMo V2 Pro", provider: "opencode", maxContext: 1048576 },
  { id: "opencode/nemotron-3-ultra-free", name: "Nemotron 3 Ultra", provider: "opencode", maxContext: 1000000 },
  { id: "opencode/laguna-s-2.1-free", name: "Laguna S 2.1", provider: "opencode", maxContext: 256000 },
  { id: "opencode/ling-3.0-flash-free", name: "Ling 3.0 Flash", provider: "opencode", maxContext: 262144 },
  { id: "opencode/north-mini-code-free", name: "North Mini Code", provider: "opencode", maxContext: 256000 },
  { id: "opencode/hy3-free", name: "Hy3", provider: "opencode", maxContext: 190000 },
  { id: "opencode/qwen3.6-plus-free", name: "Qwen 3.6 Plus", provider: "opencode", maxContext: 262144 },
  { id: "opencode/kimi-k2.5-free", name: "Kimi K2.5", provider: "opencode", maxContext: 262144 },
  { id: "opencode/minimax-m3-free", name: "MiniMax M3", provider: "opencode", maxContext: 200000 },
  { id: "opencode/ring-2.6-1t-free", name: "Ring 2.6 1T", provider: "opencode", maxContext: 262000 },
];

export const KILO_MODELS: FreeModel[] = [
  { id: "cohere/north-mini-code:free", name: "North Mini Code", provider: "kilo", maxContext: 262144 },
  { id: "inclusionai/ling-3.0-flash:free", name: "Ling 3.0 Flash", provider: "kilo", maxContext: 262144 },
  { id: "kilo/kilo-auto/free", name: "Kilo Auto", provider: "kilo", maxContext: 205000 },
  { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", name: "Nemotron 3 Nano Omni", provider: "kilo", maxContext: 262144 },
  { id: "nvidia/nemotron-3-super-120b-a12b:free", name: "Nemotron 3 Super", provider: "kilo", maxContext: 262144 },
  { id: "nvidia/nemotron-3-ultra-550b-a55b:free", name: "Nemotron 3 Ultra", provider: "kilo", maxContext: 1000000 },
  { id: "nvidia/nemotron-3.5-content-safety:free", name: "Nemotron 3.5 Safety", provider: "kilo", maxContext: 262144 },
  { id: "kilo/openrouter/free", name: "Auto Free Router", provider: "kilo", maxContext: 200000 },
  { id: "poolside/laguna-s-2.1:free", name: "Laguna S 2.1", provider: "kilo", maxContext: 262144 },
  { id: "poolside/laguna-xs-2.1:free", name: "Laguna XS 2.1", provider: "kilo", maxContext: 262144 },
  { id: "stepfun/step-3.7-flash:free", name: "Step 3.7 Flash", provider: "kilo", maxContext: 262144 },
  { id: "tencent/hy3:free", name: "Hy3", provider: "kilo", maxContext: 262144 },
];

export const ALL_MODELS: FreeModel[] = [...OPENCODE_MODELS, ...KILO_MODELS];

export const DEFAULT_MODEL_ID = "opencode/deepseek-v4-flash-free";

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
