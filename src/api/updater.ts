import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { logger } from "./logger.js";

const execFileAsync = promisify(execFile);
const REPO = "itarqos5/codejet";
const APP_ROOT = join(import.meta.dirname, "../..");

function readVersion(root = APP_ROOT): string {
  try {
    const pkgPath = join(root, "package.json");
    if (!existsSync(pkgPath)) return "0.0.0";
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export const VERSION = readVersion();

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
  // The updater installs from main, so use main/package.json as the source of truth.
  // Releases can lag behind main and would otherwise hide newer commits.
  const endpoints = [
    `https://raw.githubusercontent.com/${REPO}/main/package.json`,
    `https://api.github.com/repos/${REPO}/releases/latest`,
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
        logger.warn("updater", `${url} returned ${res.status}`);
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
      logger.warn(
        "updater",
        `Failed to fetch ${url}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return null;
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  logger.info("updater", `Checking for updates (current: v${VERSION})`);

  const remote = await fetchRemoteVersion();

  if (!remote) {
    logger.warn("updater", "Could not fetch remote version from any endpoint");
    return null;
  }

  logger.info("updater", `Remote version: v${remote}`);

  if (!isNewer(remote, VERSION)) {
    logger.info("updater", `v${VERSION} is up to date (remote: v${remote})`);
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

async function shellExec(
  cmd: string,
  args: string[],
  cwd = APP_ROOT,
): Promise<{ stdout: string; stderr: string }> {
  const isWindows = process.platform === "win32";
  const options = {
    cwd,
    windowsHide: true,
    timeout: 120000,
  };

  if (isWindows) {
    return execFileAsync("cmd.exe", ["/d", "/s", "/c", cmd, ...args], options);
  }
  return execFileAsync(cmd, args, options);
}

export async function installUpdate(
  expectedVersion?: string,
  onProgress?: (progress: UpdateProgress) => void,
): Promise<boolean> {
  try {
    if (!existsSync(join(APP_ROOT, ".git"))) {
      throw new Error(`CodeJet installation is not a Git checkout: ${APP_ROOT}`);
    }

    onProgress?.({ task: "Fetching the latest CodeJet source...", percent: 5 });
    await shellExec("git", ["fetch", "origin", "main"]);

    onProgress?.({ task: "Applying the latest CodeJet source...", percent: 25 });
    await shellExec("git", ["pull", "--ff-only", "origin", "main"]);

    const pulledVersion = readVersion();
    if (expectedVersion && pulledVersion !== expectedVersion) {
      throw new Error(`Source updated, but installed package is v${pulledVersion}; expected v${expectedVersion}`);
    }

    onProgress?.({ task: "Installing dependencies...", percent: 50 });
    await shellExec("npm", ["install"]);

    onProgress?.({ task: "Building the updated application...", percent: 75 });
    await shellExec("npm", ["run", "build"]);

    const builtVersion = readVersion();
    if (expectedVersion && builtVersion !== expectedVersion) {
      throw new Error(`Build completed with v${builtVersion}; expected v${expectedVersion}`);
    }

    onProgress?.({ task: "Update installed successfully.", percent: 100 });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    onProgress?.({ task: `Update failed: ${message}`, percent: -1 });
    return false;
  }
}

export function restartApp(): void {
  const bin = process.execPath;
  const args = process.argv.slice(1);
  const child = spawn(bin, args, {
    cwd: APP_ROOT,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  process.exit(0);
}
