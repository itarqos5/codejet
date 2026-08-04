import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { VERSION } from "../tui/models.js";

const execFileAsync = promisify(execFile);
const REPO = "itarqos5/codejet";

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
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github.v3+json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;

    const release = (await res.json()) as {
      tag_name: string;
      html_url: string;
    };

    if (!release?.tag_name) return null;

    const tag = release.tag_name.replace(/^v/, "");
    if (!isNewer(tag, VERSION)) return null;

    return {
      version: tag,
      tag: release.tag_name,
      url: release.html_url,
    };
  } catch {
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
