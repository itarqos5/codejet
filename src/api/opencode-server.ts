import { spawn, type ChildProcess } from "node:child_process";

const OPENCODE_PORT = 4096;
const OPENCODE_HOST = "127.0.0.1";

let serverProcess: ChildProcess | null = null;
let serverReady = false;

export function getOpenCodeBaseUrl(): string {
  return `http://${OPENCODE_HOST}:${OPENCODE_PORT}`;
}

export function isServerReady(): boolean {
  return serverReady;
}

async function pingServer(): Promise<boolean> {
  try {
    const res = await fetch(`${getOpenCodeBaseUrl()}/global/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function waitForServer(timeoutMs = 15000): Promise<boolean> {
  if (serverReady && await pingServer()) return true;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await pingServer()) {
      serverReady = true;
      return true;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  serverReady = false;
  return false;
}

export function startServer(): void {
  if (serverProcess) return;

  try {
    serverProcess = spawn("opencode", ["serve", "--port", String(OPENCODE_PORT), "--hostname", OPENCODE_HOST], {
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
      windowsHide: true,
    });

    serverProcess.on("error", () => {
      serverProcess = null;
      serverReady = false;
    });

    serverProcess.on("exit", () => {
      serverProcess = null;
      serverReady = false;
    });
  } catch {
    serverProcess = null;
    serverReady = false;
  }
}

export function stopServer(): void {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
    serverReady = false;
  }
}
