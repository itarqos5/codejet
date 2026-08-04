import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const LOG_DIR = join(homedir(), ".codejet", "logs");

export interface SessionError {
  timestamp: number;
  model: string;
  message: string;
}

export function logSessionErrors(errors: SessionError[]): void {
  if (errors.length === 0) return;

  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }

  const date = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const logFile = join(LOG_DIR, `session-${date}.log`);

  const lines = [
    `CodeJet Session Log — ${new Date().toISOString()}`,
    `Model: ${errors[0]?.model ?? "unknown"}`,
    `Errors: ${errors.length}`,
    "─".repeat(50),
    "",
  ];

  for (const err of errors) {
    const ts = new Date(err.timestamp).toISOString();
    lines.push(`[${ts}] ${err.message}`);
    lines.push("");
  }

  appendFileSync(logFile, lines.join("\n"), "utf-8");
}
