import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const execFileAsync = promisify(execFile);
const REPO = "itarqos5/codejet";

function getVersion(): string {
  try {
    const pkgPath = join(import.meta.dirname, "../../package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return pkg.version;
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

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const res = await fetch(
      `https://raw.githubusercontent.com/${REPO}/main/package.json`,
      { signal: AbortSignal.timeout(8000) },
    );

    if (!res.ok) {
      console.error(`[updater] GitHub raw returned ${res.status}`);
      return null;
    }

    const pkg = (await res.json()) as { version?: string };
    const remote = pkg?.version;

    if (!remote) {
      console.error("[updater] No version in remote package.json");
      return null;
    }

    if (!isNewer(remote, VERSION)) {
      console.log(`[updater] v${VERSION} is up to date (remote: v${remote})`);
      return null;
    }

    return {
      version: remote,
      tag: `v${remote}`,
      url: `https://github.com/${REPO}/releases/tag/v${remote}`,
    };
  } catch (err) {
    console.error("[updater] Check failed:", err);
    return null;
  }
}

export async function installUpdate(
  onProgress?: (line: string) => void,
): Promise<boolean> {
  try {
    onProgress?.("Fetching latest from origin...");
    await execFileAsync("git", ["fetch", "origin", "main"]);

    onProgress?.("Pulling updates...");
    const { stdout } = await execFileAsync("git", ["pull", "origin", "main"]);
    onProgress?.(stdout.trim());

    onProgress?.("Installing dependencies...");
    await execFileAsync("npm", ["install"]);

    onProgress?.("Building...");
    await execFileAsync("npm", ["run", "build"]);

    onProgress?.("Update complete!");
    return true;
  } catch (err) {
    onProgress?.(`Error: ${err instanceof Error ? err.message : String(err)}`);
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
