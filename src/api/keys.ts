import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface ApiKeys {
  opencode_token: string;
  kilo_token: string;
}

const KEYS_PATH = join(homedir(), ".codejet", "keys.json");

export function loadKeys(): ApiKeys {
  if (!existsSync(KEYS_PATH)) {
    return { opencode_token: "", kilo_token: "" };
  }

  try {
    const raw = readFileSync(KEYS_PATH, "utf-8");
    const data = JSON.parse(raw) as Partial<ApiKeys>;
    return {
      opencode_token: data.opencode_token ?? "",
      kilo_token: data.kilo_token ?? "",
    };
  } catch {
    return { opencode_token: "", kilo_token: "" };
  }
}
