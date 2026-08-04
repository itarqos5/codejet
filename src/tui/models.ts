export interface FreeModel {
  id: string;
  name: string;
  provider: "kilo" | "opencode";
  maxContext: number;
}

export const FREE_MODELS: FreeModel[] = [
  // Kilo Code free models
  { id: "qwen/qwen3-235b-a22b", name: "Qwen3 235B", provider: "kilo", maxContext: 131072 },
  { id: "qwen/qwen3-coder", name: "Qwen3 Coder", provider: "kilo", maxContext: 131072 },
  { id: "google/gemma-3-27b-it", name: "Gemma 3 27B", provider: "kilo", maxContext: 131072 },
  { id: "microsoft/phi-4-reasoning-plus", name: "Phi-4 Reasoning+", provider: "kilo", maxContext: 131072 },
  { id: "deepseek/deepseek-r1", name: "DeepSeek R1", provider: "kilo", maxContext: 131072 },
  { id: "deepseek/deepseek-v3-0324", name: "DeepSeek V3", provider: "kilo", maxContext: 131072 },
  { id: "meta-llama/llama-4-maverick", name: "Llama 4 Maverick", provider: "kilo", maxContext: 131072 },
  { id: "nvidia/llama-3.1-nemotron-70b-instruct", name: "Nemotron 70B", provider: "kilo", maxContext: 131072 },
  // OpenCode models (local server)
  { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", provider: "opencode", maxContext: 200000 },
  { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku", provider: "opencode", maxContext: 200000 },
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "opencode", maxContext: 128000 },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", provider: "opencode", maxContext: 128000 },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "opencode", maxContext: 1048576 },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "opencode", maxContext: 1048576 },
];

export function getModelById(id: string): FreeModel | undefined {
  return FREE_MODELS.find((m) => m.id === id);
}

export function formatContextUsage(used: number, max: number): string {
  const kUsed = (used / 1000).toFixed(1);
  const pct = Math.round((used / max) * 100);
  return `${kUsed}K (${pct}%)`;
}
