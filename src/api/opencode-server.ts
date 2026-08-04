import { spawn, type ChildProcess } from "node:child_process";

const OPENCODE_PORT = 4096;
const OPENCODE_HOST = "127.0.0.1";

let serverProcess: ChildProcess | null = null;
let serverReady = false;
let readyPromise: Promise<void> | null = null;

export function getOpenCodeBaseUrl(): string {
  return `http://${OPENCODE_HOST}:${OPENCODE_PORT}`;
}

export function isServerReady(): boolean {
  return serverReady;
}

export async function waitForServer(timeoutMs = 15000): Promise<boolean> {
  if (serverReady) return true;
  if (!readyPromise) return false;

  return Promise.race([
    readyPromise.then(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
  ]);
}

export function startServer(): void {
  if (serverProcess) return;

  serverProcess = spawn("opencode", ["serve", "--port", String(OPENCODE_PORT), "--hostname", OPENCODE_HOST], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
    windowsHide: true,
  });

  readyPromise = new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      serverReady = true;
      resolve();
    }, 5000);

    let output = "";
    const onData = (chunk: Buffer) => {
      output += chunk.toString();
      if (output.includes("Listening") || output.includes("started") || output.includes("ready") || output.includes("http")) {
        clearTimeout(timeout);
        serverReady = true;
        resolve();
      }
    };

    serverProcess?.stdout?.on("data", onData);
    serverProcess?.stderr?.on("data", onData);

    serverProcess?.on("error", () => {
      clearTimeout(timeout);
      serverReady = true;
      resolve();
    });

    serverProcess?.on("exit", () => {
      clearTimeout(timeout);
      serverProcess = null;
      serverReady = false;
    });
  });
}

export function stopServer(): void {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
    serverReady = false;
  }
}
