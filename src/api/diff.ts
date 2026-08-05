/**
 * Minimal line differ used to show what actually changed when the agent writes
 * a file.
 *
 * Deliberately dependency-free and bounded: an LCS table is quadratic, so past
 * a size threshold it degrades to a summary rather than stalling the UI while a
 * response is streaming.
 */

export type DiffKind = "add" | "del" | "ctx";

export interface DiffLine {
  kind: DiffKind;
  text: string;
  /** 1-based line number in the original file, for context and deletions. */
  oldNo?: number;
  /** 1-based line number in the new file, for context and additions. */
  newNo?: number;
}

export interface DiffResult {
  added: number;
  removed: number;
  /** Changed lines plus a little surrounding context, capped by `maxLines`. */
  lines: DiffLine[];
  /** True when `lines` omits changes because the cap was reached. */
  truncated: boolean;
  /** True when the files were too large to diff precisely. */
  approximate: boolean;
}

/** Above this many cells the LCS table is not worth building. */
const MAX_LCS_CELLS = 2_000_000;

function splitLines(text: string): string[] {
  if (text === "") return [];
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

/** Longest-common-subsequence backtrace over whole lines. */
function lcsOps(a: string[], b: string[]): DiffLine[] {
  const n = a.length;
  const m = b.length;

  // table[i][j] = LCS length of a[i:] and b[j:]
  const table: Uint32Array[] = Array.from(
    { length: n + 1 },
    () => new Uint32Array(m + 1),
  );

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] =
        a[i] === b[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const ops: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ kind: "ctx", text: a[i], oldNo: i + 1, newNo: j + 1 });
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      ops.push({ kind: "del", text: a[i], oldNo: i + 1 });
      i++;
    } else {
      ops.push({ kind: "add", text: b[j], newNo: j + 1 });
      j++;
    }
  }
  while (i < n) {
    ops.push({ kind: "del", text: a[i], oldNo: i + 1 });
    i++;
  }
  while (j < m) {
    ops.push({ kind: "add", text: b[j], newNo: j + 1 });
    j++;
  }

  return ops;
}

/** Coarse fallback for files too large to diff exactly. */
function approximateOps(a: string[], b: string[]): DiffLine[] {
  const ops: DiffLine[] = [];
  const common = Math.min(a.length, b.length);
  let changed = 0;

  for (let i = 0; i < common; i++) {
    if (a[i] !== b[i]) {
      ops.push({ kind: "del", text: a[i], oldNo: i + 1 });
      ops.push({ kind: "add", text: b[i], newNo: i + 1 });
      changed++;
      if (changed > 200) break;
    }
  }
  for (let i = common; i < b.length; i++) {
    ops.push({ kind: "add", text: b[i], newNo: i + 1 });
  }
  for (let i = common; i < a.length; i++) {
    ops.push({ kind: "del", text: a[i], oldNo: i + 1 });
  }

  return ops;
}

/**
 * Keeps only changed lines plus `context` lines around each change, then caps
 * the total at `maxLines`.
 */
function condense(
  ops: DiffLine[],
  context: number,
  maxLines: number,
): { lines: DiffLine[]; truncated: boolean } {
  const keep = new Array<boolean>(ops.length).fill(false);

  for (let i = 0; i < ops.length; i++) {
    if (ops[i].kind === "ctx") continue;
    const from = Math.max(0, i - context);
    const to = Math.min(ops.length - 1, i + context);
    for (let j = from; j <= to; j++) keep[j] = true;
  }

  const lines: DiffLine[] = [];
  let truncated = false;
  for (let i = 0; i < ops.length; i++) {
    if (!keep[i]) continue;
    if (lines.length >= maxLines) {
      truncated = true;
      break;
    }
    lines.push(ops[i]);
  }

  return { lines, truncated };
}

export function diffLines(
  oldText: string,
  newText: string,
  opts: { maxLines?: number; context?: number } = {},
): DiffResult {
  const maxLines = opts.maxLines ?? 12;
  const context = opts.context ?? 1;

  const a = splitLines(oldText);
  const b = splitLines(newText);

  const approximate = (a.length + 1) * (b.length + 1) > MAX_LCS_CELLS;
  const ops = approximate ? approximateOps(a, b) : lcsOps(a, b);

  let added = 0;
  let removed = 0;
  for (const op of ops) {
    if (op.kind === "add") added++;
    else if (op.kind === "del") removed++;
  }

  const { lines, truncated } = condense(ops, context, maxLines);
  return { added, removed, lines, truncated, approximate };
}

/** `+12 -3` style summary, or `no changes`. */
export function formatDiffStat(added: number, removed: number): string {
  if (added === 0 && removed === 0) return "no changes";
  const parts: string[] = [];
  if (added > 0) parts.push(`+${added}`);
  if (removed > 0) parts.push(`-${removed}`);
  return parts.join(" ");
}
