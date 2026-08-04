import { spawn, execSync, type ChildProcess } from "node:child_process";

const OPENCODE_PORT = 4096;
const OPENCODE_HOST = "127.0.0.1";

let serverProcess: ChildProcess | null = null;
let serverReady = false;
let lastError: string | null = null;

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
      signal: AbortSignal.timeout(2000),
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
      });
      const lines = output.split("\n").filter((l) => l.includes("LISTENING"));
      for (const line of lines) {
        const pid = line.trim().split(/\s+/).pop();
        if (pid && pid !== "0") {
          try { execSync(`taskkill /F /PID ${pid}`, { timeout: 3000 }); } catch {}
        }
      }
    } else {
      try { execSync(`lsof -ti:${OPENCODE_PORT} | xargs kill -9`, { timeout: 3000 }); } catch {}
    }
  } catch {}
}

export async function waitForServer(timeoutMs = 15000): Promise<boolean> {
  if (serverReady && await pingServer()) return true;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await pingServer()) {
      serverReady = true;
      lastError = null;
      return true;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  serverReady = false;
  return false;
}

export async function startServer(): Promise<boolean> {
  if (serverProcess && serverReady) {
    if (await pingServer()) return true;
  }

  killPortProcess();
  await new Promise((r) => setTimeout(r, 500));

  try {
    serverProcess = spawn("opencode", ["serve", "--port", String(OPENCODE_PORT), "--hostname", OPENCODE_HOST], {
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
      windowsHide: true,
      shell: process.platform === "win32",
    });

    let stderrOutput = "";
    serverProcess.stderr?.on("data", (chunk: Buffer) => {
      stderrOutput += chunk.toString();
    });

    serverProcess.on("error", (err) => {
      lastError = `Failed to start opencode: ${err.message}`;
      serverProcess = null;
      serverReady = false;
    });

    serverProcess.on("exit", (code, signal) => {
      if (!serverReady) {
        lastError = `opencode exited before ready (code=${code}, signal=${signal})`;
        if (stderrOutput) {
          lastError += `\nStderr: ${stderrOutput.slice(0, 500)}`;
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

  return waitForServer(12000);
}

export function stopServer(): void {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
    serverReady = false;
  }
}
