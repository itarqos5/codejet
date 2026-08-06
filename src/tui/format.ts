import { homedir } from "node:os";
import { isAbsolute, relative, resolve, sep } from "node:path";

/**
 * Presentation helpers shared by every activity row.
 *
 * These exist so the transcript reads like the installer transcript: a short
 * human verb, a target the user recognises, and a value on the right. Raw tool
 * names (`create_directory`) and absolute paths (`C:\Users\…\src\tui\app.tsx`)
 * carry no extra information in context and push the interesting part of the
 * row off the screen.
 */

/** Verb pairs: how a tool reads while it runs, and once it has finished. */
const TOOL_LABELS: Record<string, { active: string; done: string }> = {
    read: { active: "Reading", done: "Read" },
    write: { active: "Writing", done: "Wrote" },
    edit: { active: "Editing", done: "Edited" },
    create_file: { active: "Creating", done: "Created" },
    create_directory: { active: "Creating", done: "Created" },
    delete_file: { active: "Deleting", done: "Deleted" },
    delete_directory: { active: "Deleting", done: "Deleted" },
    list: { active: "Listing", done: "Listed" },
    glob: { active: "Finding", done: "Found" },
    grep: { active: "Searching", done: "Searched" },
    bash: { active: "Running", done: "Ran" },
    webfetch: { active: "Fetching", done: "Fetched" },
    todo: { active: "Updating todos", done: "Todos" },
    think: { active: "Thinking", done: "Thought" },
    ask: { active: "Asking", done: "Asked" },
};

/** Tools whose detail is a filesystem path and should be shortened as one. */
const PATH_TOOLS = new Set([
    "read",
    "write",
    "edit",
    "create_file",
    "create_directory",
    "delete_file",
    "delete_directory",
    "list",
    "glob",
]);

/** `create_directory` -> `Create directory`, for tools with no explicit verb. */
function prettifyToolName(name: string): string {
    const words = name.replace(/[_-]+/g, " ").trim();
    if (!words) return "Tool";
    return words.charAt(0).toUpperCase() + words.slice(1);
}

export function toolLabel(name: string, phase: "active" | "done"): string {
    const entry = TOOL_LABELS[name];
    if (entry) return phase === "active" ? entry.active : entry.done;
    return prettifyToolName(name);
}

/**
 * Rewrites a path relative to the working directory, falling back to `~` for
 * anything else under the home directory. Separators are normalised to `/` so
 * a Windows transcript does not read as a wall of backslashes.
 */
export function shortenPath(input: string, cwd: string = process.cwd()): string {
    const raw = (input ?? "").trim();
    if (!raw) return "";

    let out = raw;
    try {
        const absolute = isAbsolute(raw) ? raw : resolve(cwd, raw);

        const fromCwd = relative(cwd, absolute);
        if (fromCwd && !fromCwd.startsWith("..") && !isAbsolute(fromCwd)) {
            out = fromCwd;
        } else {
            const fromHome = relative(homedir(), absolute);
            out =
                fromHome && !fromHome.startsWith("..") && !isAbsolute(fromHome)
                    ? `~${sep}${fromHome}`
                    : absolute;
        }
    } catch {
        out = raw;
    }

    return out.split(sep).join("/");
}

/**
 * Clamps a path from the left, keeping the file name visible.
 *
 * `truncate` drops the tail, which is exactly the part that identifies the
 * file — `src/tui/components/file-cha…` tells you nothing useful.
 */
export function fitPath(path: string, width: number): string {
    if (width <= 0) return "";
    if (path.length <= width) return path;
    if (width <= 1) return path.slice(path.length - width);
    return "…" + path.slice(path.length - (width - 1));
}

/** The target of a tool call, formatted for its own kind of value. */
export function toolTarget(name: string, detail: string, width: number): string {
    const value = (detail ?? "").split("\n", 1)[0]?.trim() ?? "";
    if (!value || width <= 0) return "";

    if (PATH_TOOLS.has(name)) return fitPath(shortenPath(value), width);

    const clean = value.replace(/\s+/g, " ");
    if (clean.length <= width) return clean;
    return clean.slice(0, Math.max(1, width - 1)) + "…";
}

/** `840ms`, `3.2s`, `1m04s` — compact and monotonic in length. */
export function formatDuration(ms: number): string {
    if (!Number.isFinite(ms) || ms < 0) return "";
    if (ms < 1000) return `${Math.round(ms)}ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m${String(Math.floor(seconds % 60)).padStart(2, "0")}s`;
}
