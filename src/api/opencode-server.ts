import { spawn, execSync, type ChildProcess } from "node:child_process";

const OPENCODE_PORT = 4096;
const OPENCODE_HOST = "127.0.0.1";

let serverProcess: ChildProcess | null = null;
let serverReady = false;
let lastError: string | null = null;
let serverStartTime = 0;

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
      // Use netstat to find process using the port
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

export async function waitForServer(timeoutMs = 20000): Promise<boolean> {
  if (serverReady && await pingServer()) return true;

  const deadline = Date.now() + timeoutMs;
  let lastStatusMessage = "";
  
  while (Date.now() < deadline) {
    const isReady = await pingServer();
    if (isReady) {
      serverReady = true;
      lastError = null;
      console.log(`[opencode-server] Server ready after ${Date.now() - serverStartTime}ms`);
      return true;
    }
    
    // Log status periodically
    const elapsed = Date.now() - serverStartTime;
    if (elapsed > 5000 && elapsed % 2000 < 100) {
      console.log(`[opencode-server] Waiting for server... (${elapsed}ms)`);
    }
    
    await new Promise((r) => setTimeout(r, 500));
  }

  serverReady = false;
  return false;
}

export async function startServer(): Promise<boolean> {
  // Check if already running
  if (serverProcess && serverReady) {
    if (await pingServer()) {
      console.log("[opencode-server] Server already running");
      return true;
    }
  }

  // Kill any existing process on the port
  killPortProcess();
  await new Promise((r) => setTimeout(r, 1000));

  serverStartTime = Date.now();
  lastError = null;
  serverReady = false;

  try {
    console.log("[opencode-server] Starting OpenCode server...");
    
    serverProcess = spawn("opencode", ["serve", "--port", String(OPENCODE_PORT), "--hostname", OPENCODE_HOST], {
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
      windowsHide: true,
      shell: true,
    });

    let stderrOutput = "";
    let stdoutOutput = "";

    serverProcess.stdout?.on("data", (chunk: Buffer) => {
      stdoutOutput += chunk.toString();
      // Log server output for debugging
      const lines = stdoutOutput.split("\n");
      if (lines.length > 5) {
        console.log("[opencode-server]", lines.slice(-3).join("\n"));
        stdoutOutput = lines.slice(-1).join("\n");
      }
    });

    serverProcess.stderr?.on("data", (chunk: Buffer) => {
      stderrOutput += chunk.toString();
    });

    serverProcess.on("error", (err) => {
      lastError = `Failed to start opencode: ${err.message}`;
      console.error("[opencode-server]", lastError);
      serverProcess = null;
      serverReady = false;
    });

    serverProcess.on("exit", (code, signal) => {
      if (!serverReady) {
        lastError = `opencode exited before ready (code=${code}, signal=${signal})`;
        if (stderrOutput) {
          lastError += `\nStderr: ${stderrOutput.slice(0, 500)}`;
        }
        console.error("[opencode-server]", lastError);
      }
      serverProcess = null;
      serverReady = false;
    });
  } catch (err) {
    lastError = `Exception starting opencode: ${err instanceof Error ? err.message : String(err)}`;
    console.error("[opencode-server]", lastError);
    serverProcess = null;
    serverReady = false;
    return false;
  }

  const success = await waitForServer(20000);
  if (!success && lastError) {
    console.error("[opencode-server] Failed to start:", lastError);
  }
  return success;
}

export function stopServer(): void {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    // Force kill after 5 seconds
    setTimeout(() => {
      if (serverProcess) {
        serverProcess.kill("SIGKILL");
      }
    }, 5000);
    serverProcess = null;
    serverReady = false;
  }
}

// Cleanup on exit
process.on("exit", () => stopServer());
process.on("SIGINT", () => { stopServer(); process.exit(0); });
process.on("SIGTERM", () => { stopServer(); process.exit(0); });
