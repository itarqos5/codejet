import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

const execFileAsync = promisify(execFile);
const REPO = "itarqos5/codejet";

function getVersion(): string {
  try {
    // Try multiple possible paths for package.json
    const possiblePaths = [
      join(import.meta.dirname, "../../package.json"),
      join(import.meta.dirname, "../package.json"),
      join(process.cwd(), "package.json"),
    ];
    
    for (const pkgPath of possiblePaths) {
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        return pkg.version || "0.0.0";
      }
    }
    return "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export const VERSION = getVersion();

export interface UpdateInfo {
  version: string;
  tag: string;
  url: string;
}

function parseSemver(v: string): [number, number, number] {
  const parts = v.replace(/^v/, "").split(".").map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function isNewer(latest: string, current: string): boolean {
  const [aMajor, aMinor, aPatch] = parseSemver(latest);
  const [bMajor, bMinor, bPatch] = parseSemver(current);
  if (aMajor !== bMajor) return aMajor > bMajor;
  if (aMinor !== bMinor) return aMinor > bMinor;
  return aPatch > bPatch;
}

// Try multiple GitHub endpoints for fetching version
async function fetchRemoteVersion(): Promise<string | null> {
  const endpoints = [
    // Try GitHub API first (most reliable)
    `https://api.github.com/repos/${REPO}/releases/latest`,
    // Fallback to raw package.json
    `https://raw.githubusercontent.com/${REPO}/main/package.json`,
    // Try main branch directly
    `https://raw.githubusercontent.com/${REPO}/master/package.json`,
  ];

  const fetchOptions = {
    headers: {
      "User-Agent": "CodeJet-Updater",
      "Accept": "application/json",
    },
  };

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        ...fetchOptions,
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        console.error(`[updater] ${url} returned ${res.status}`);
        continue;
      }

      const ct = res.headers.get("content-type") ?? "";
      
      if (url.includes("api.github.com")) {
        // GitHub API response
        const data = await res.json() as { tag_name?: string; name?: string; version?: string };
        const version = data.tag_name?.replace(/^v/, "") || data.name || data.version;
        if (version) return version;
      } else {
        // Raw package.json
        const pkg = (await res.json()) as { version?: string };
        if (pkg?.version) return pkg.version;
      }
    } catch (err) {
      console.error(`[updater] Failed to fetch ${url}:`, err instanceof Error ? err.message : String(err));
    }
  }

  return null;
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  console.log(`[updater] Checking for updates (current: v${VERSION})...`);
  
  const remote = await fetchRemoteVersion();

  if (!remote) {
    console.error("[updater] Could not fetch remote version from any endpoint");
    return null;
  }

  console.log(`[updater] Remote version: v${remote}`);

  if (!isNewer(remote, VERSION)) {
    console.log(`[updater] v${VERSION} is up to date (remote: v${remote})`);
    return null;
  }

  return {
    version: remote,
    tag: `v${remote}`,
    url: `https://github.com/${REPO}/releases/tag/v${remote}`,
  };
}

export interface UpdateProgress {
  task: string;
  percent: number;
}

// Shell-aware exec that works on Windows (fixes ENOENT for npm/git)
async function shellExec(
  cmd: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  const isWindows = process.platform === "win32";
  if (isWindows) {
    // On Windows, run through cmd.exe to resolve PATH correctly
    return execFileAsync("cmd.exe", ["/c", cmd, ...args], {
      windowsHide: true,
      timeout: 120000,
    });
  }
  return execFileAsync(cmd, args, { timeout: 120000 });
}

export async function installUpdate(
  onProgress?: (progress: UpdateProgress) => void,
): Promise<boolean> {
  try {
    onProgress?.({ task: "Fetching latest from origin...", percent: 5 });
    await shellExec("git", ["fetch", "origin", "main"]);

    onProgress?.({ task: "Pulling updates...", percent: 20 });
    await shellExec("git", ["pull", "origin", "main"]);

    onProgress?.({ task: "Installing dependencies...", percent: 45 });
    await shellExec("npm", ["install"]);

    onProgress?.({ task: "Building project...", percent: 75 });
    await shellExec("npm", ["run", "build"]);

    onProgress?.({ task: "Finalizing...", percent: 95 });
    // Small delay for visual feedback
    await new Promise((r) => setTimeout(r, 500));

    onProgress?.({ task: "Update complete!", percent: 100 });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    onProgress?.({ task: `Error: ${message}`, percent: -1 });
    return false;
  }
}

export function restartApp(): void {
  const bin = process.argv[0];
  const args = process.argv.slice(1);
  const child = spawn(bin, args, { detached: true, stdio: "ignore" });
  child.unref();
  process.exit(0);
}
