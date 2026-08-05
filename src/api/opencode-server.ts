import { spawn, execSync, type ChildProcess } from "node:child_process";
import { logger } from "./logger.js";
import { provisionOpenCodeTools, requiresServerRestart } from "./opencode-tools.js";

const OPENCODE_PORT = 4096;
const OPENCODE_HOST = "127.0.0.1";

let serverProcess: ChildProcess | null = null;
let serverReady = false;
let lastError: string | null = null;
let serverStartTime = 0;
let isShuttingDown = false;

/** Set when tools changed but the live server was started by someone else. */
let staleToolsWarning: string | null = null;

export function getStaleToolsWarning(): string | null {
  return staleToolsWarning;
}

export function getOpenCodeBaseUrl(): string {
  return `http://${OPENCODE_HOST}:${OPENCODE_PORT}`;
}

export function isServerReady(): boolean {
  return serverReady;
}

export function getLastError(): string | null {
  return lastError;
}

async function pingServer(): Promise<boolean> {
  try {
    const res = await fetch(`${getOpenCodeBaseUrl()}/global/health`, {
      signal: AbortSignal.timeout(3000),
      headers: { Accept: "application/json" },
    });
    const ct = res.headers.get("content-type") ?? "";
    if (!res.ok || !ct.includes("application/json")) return false;
    const data = (await res.json()) as { healthy?: boolean };
    return data.healthy === true;
  } catch {
    return false;
  }
}

function killPortProcess(): void {
  try {
    if (process.platform === "win32") {
      const output = execSync(`netstat -ano | findstr :${OPENCODE_PORT}`, {
        encoding: "utf-8",
        timeout: 3000,
        windowsHide: true,
      });
      const lines = output.split("\n").filter((l) => l.includes("LISTENING"));
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== "0" && !isNaN(parseInt(pid))) {
          try {
            execSync(`taskkill /F /PID ${pid}`, { timeout: 3000, windowsHide: true });
          } catch {}
        }
      }
    } else {
      try { execSync(`lsof -ti:${OPENCODE_PORT} | xargs kill -9`, { timeout: 3000 }); } catch {}
    }
  } catch {}
}

export async function waitForServer(timeoutMs = 25000): Promise<boolean> {
  if (serverReady && await pingServer()) return true;

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (isShuttingDown) return false;

    const isReady = await pingServer();
    if (isReady) {
      serverReady = true;
      lastError = null;
      return true;
    }

    await new Promise((r) => setTimeout(r, 800));
  }

  serverReady = false;
  return false;
}

export async function startServer(): Promise<boolean> {
  // Install CodeJet's tools before the server boots. OpenCode reads its tools
  // directory at startup, so this has to happen first to have any effect.
  const provisioned = provisionOpenCodeTools();
  staleToolsWarning = null;

  // First check if opencode is already running externally
  const alreadyRunning = await pingServer();
  if (alreadyRunning) {
    serverReady = true;
    lastError = null;

    // We must not restart a server we did not start, but the user should know
    // its tool set is out of date.
    if (requiresServerRestart(provisioned)) {
      staleToolsWarning =
        "An OpenCode server was already running, so newly installed CodeJet tools " +
        "(including think) are not loaded. Restart that server to pick them up.";
      logger.warn("opencode", staleToolsWarning);
    }
    return true;
  }

  // Check if already running from us
  if (serverProcess && serverReady) {
    if (await pingServer()) return true;
  }

  // Kill any stale process on the port
  killPortProcess();
  await new Promise((r) => setTimeout(r, 800));

  serverStartTime = Date.now();
  lastError = null;
  serverReady = false;

  try {
    const isWindows = process.platform === "win32";

    // shell: true with an args array triggers DEP0190 (args are concatenated
    // unescaped). The command and its arguments are compile-time constants,
    // so pass a single command string and no args array instead.
    const command = `opencode serve --port ${OPENCODE_PORT} --hostname ${OPENCODE_HOST}`;

    serverProcess = spawn(command, {
      stdio: ["ignore", "pipe", "pipe"],
      detached: !isWindows, // detach on unix so it survives parent
      windowsHide: true,
      shell: true,
    });

    let stderrOutput = "";

    serverProcess.stdout?.on("data", () => {
      // Drain stdout to prevent buffer blocking
    });

    serverProcess.stderr?.on("data", (chunk: Buffer) => {
      stderrOutput += chunk.toString();
      // Keep only last 1KB
      if (stderrOutput.length > 1024) {
        stderrOutput = stderrOutput.slice(-1024);
      }
    });

    serverProcess.on("error", (err) => {
      lastError = `Failed to start opencode: ${err.message}`;
      serverProcess = null;
      serverReady = false;
    });

    serverProcess.on("exit", (code, signal) => {
      if (!serverReady && !isShuttingDown) {
        lastError = `opencode exited before ready (code=${code}, signal=${signal})`;
        if (stderrOutput.trim()) {
          lastError += `\nStderr: ${stderrOutput.slice(0, 300)}`;
        }
      }
      serverProcess = null;
      serverReady = false;
    });
  } catch (err) {
    lastError = `Exception starting opencode: ${err instanceof Error ? err.message : String(err)}`;
    serverProcess = null;
    serverReady = false;
    return false;
  }

  const success = await waitForServer(25000);
  return success;
}

export function stopServer(): void {
  isShuttingDown = true;
  if (serverProcess) {
    try {
      if (process.platform === "win32") {
        // On Windows, kill the process tree
        const pid = serverProcess.pid;
        if (pid) {
          try {
            execSync(`taskkill /F /T /PID ${pid}`, { windowsHide: true, timeout: 3000 });
          } catch {}
        }
      } else {
        serverProcess.kill("SIGTERM");
      }
    } catch {}
    serverProcess = null;
    serverReady = false;
  }
}
