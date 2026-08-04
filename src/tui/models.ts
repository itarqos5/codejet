import { readFileSync } from "node:fs";
import { join } from "node:path";

const pkg = JSON.parse(readFileSync(join(import.meta.dirname, "../../package.json"), "utf-8"));
export const VERSION: string = pkg.version;

export interface FreeModel {
  id: string;
  name: string;
  provider: "kilo";
  maxContext: number;
}

export const FREE_MODELS: FreeModel[] = [
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
];

export const DEFAULT_MODEL_ID = "nvidia/nemotron-3-ultra-550b-a55b:free";

export function getModelById(id: string): FreeModel | undefined {
  return FREE_MODELS.find((m) => m.id === id);
}

export function formatContextUsage(used: number, max: number): string {
  const kUsed = (used / 1000).toFixed(1);
  const pct = Math.round((used / max) * 100);
  return `${kUsed}K (${pct}%)`;
}
