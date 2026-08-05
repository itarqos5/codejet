import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const LOG_DIR = join(homedir(), ".codejet", "logs");

export interface SessionError {
  timestamp: number;
  model: string;
  message: string;
  type?: "opencode" | "kilo" | "unknown";
}

// Log levels for different types of messages
export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: number;
  level: LogLevel;
  source: string;
  message: string;
  details?: unknown;
}

const logBuffer: LogEntry[] = [];
const MAX_BUFFER_SIZE = 100;

// While the TUI owns the terminal, nothing may be written to stdout/stderr:
// stray writes are interleaved into ink's live frame and corrupt the layout.
// Logs are buffered and flushed to disk instead.
let tuiActive = false;

export function setTuiActive(active: boolean): void {
  tuiActive = active;
}

export function isTuiActive(): boolean {
  return tuiActive;
}

function ensureLogDir(): void {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

export function getLogDir(): string {
  ensureLogDir();
  return LOG_DIR;
}

// Central logging function
export function log(
  level: LogLevel,
  source: string,
  message: string,
  details?: unknown,
): void {
  const entry: LogEntry = {
    timestamp: Date.now(),
    level,
    source,
    message,
    details,
  };

  // Add to buffer
  logBuffer.push(entry);
  if (logBuffer.length > MAX_BUFFER_SIZE) {
    logBuffer.shift();
  }

  // Never touch stdout while the TUI is live — the log is on disk instead.
  if (tuiActive) return;

  // Console output with colors (only before/after the TUI runs, e.g. CLI usage)
  const ts = new Date().toISOString().slice(11, 19); // HH:MM:SS
  const levelColors: Record<LogLevel, string> = {
    debug: "\x1b[90m",
    info: "\x1b[36m",
    warn: "\x1b[33m",
    error: "\x1b[31m",
  };
  const color = levelColors[level];
  const reset = "\x1b[0m";

  const prefix = `${color}[${ts}] [${source.toUpperCase()}]${reset}`;
  console.log(`${prefix} ${message}`);

  if (details && level === "error") {
    console.error(`${prefix} Details:`, details);
  }
}

// Convenience logging functions
export const logger = {
  debug: (source: string, message: string, details?: unknown) => 
    log("debug", source, message, details),
  info: (source: string, message: string, details?: unknown) => 
    log("info", source, message, details),
  warn: (source: string, message: string, details?: unknown) => 
    log("warn", source, message, details),
  error: (source: string, message: string, details?: unknown) => 
    log("error", source, message, details),
};

export function logSessionErrors(errors: SessionError[]): void {
  if (errors.length === 0) return;

  ensureLogDir();

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
    const typeTag = err.type ? ` [${err.type.toUpperCase()}]` : "";
    lines.push(`[${ts}]${typeTag} ${err.message}`);
    lines.push("");
  }

  appendFileSync(logFile, lines.join("\n"), "utf-8");
}

// Flush all buffered logs to disk
export function flushLogs(): void {
  if (logBuffer.length === 0) return;
  
  ensureLogDir();
  
  const date = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const logFile = join(LOG_DIR, `codejet-${date}.log`);
  
  const lines = logBuffer.map((entry) => {
    const ts = new Date(entry.timestamp).toISOString();
    const details = entry.details ? `\n  Details: ${JSON.stringify(entry.details)}` : "";
    return `[${ts}] [${entry.level.toUpperCase()}] [${entry.source}] ${entry.message}${details}`;
  });

  try {
    appendFileSync(logFile, lines.join("\n") + "\n", "utf-8");
  } catch {
    // Never let logging failures take down the app or print to the terminal.
  }

  // Drain so repeated flushes (exit handler + explicit calls) don't duplicate.
  logBuffer.length = 0;
}

// Cleanup on exit
process.on("exit", () => flushLogs());
process.on("SIGINT", () => { flushLogs(); process.exit(0); });
process.on("uncaughtException", (err) => {
  logger.error("process", `Uncaught exception: ${err.message}`, err.stack);
  flushLogs();
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  logger.error("process", `Unhandled rejection: ${reason}`);
  flushLogs();
});
