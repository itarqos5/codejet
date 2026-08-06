import React from "react";
import { Box, Text } from "ink";
import { COLOR, GLYPH, clamp } from "../theme.js";
import { fitPath, shortenPath } from "../format.js";
import { formatDiffStat, type DiffLine } from "../../api/diff.js";
import type { FileEdit } from "../state.js";

/**
 * Renders a file the agent created, edited or deleted.
 *
 * The shape mirrors the installer transcript: one aligned status row — verb and
 * path on the left, `+n -n` on the right — and, when there is a diff, a compact
 * block of the changed lines underneath.
 *
 *     ✓ Edited  src/tui/app.tsx                                  +12 -3
 *          41 │   const width = size.width;
 *          42 │ - const rows = 3;
 *          42 │ + const rows = reservedRows;
 *           ⋯ │
 *          87 │ + <FileChangeView edit={edit} width={width} />
 *             │ 6 more changed lines
 *
 * Two rules hold the columns still: every row is built from single-cell glyphs,
 * and the body is clamped rather than truncated so leading indentation — the
 * thing that makes a diff readable — survives.
 */

const ACTION_LABEL: Record<FileEdit["action"], string> = {
  created: "Created",
  modified: "Edited",
  deleted: "Deleted",
};

function actionColor(action: FileEdit["action"]): string {
  if (action === "created") return COLOR.success;
  if (action === "deleted") return COLOR.error;
  return COLOR.warning;
}

/** Indent of the diff body, and the width of its line-number column. */
const BODY_INDENT = 4;
const NUMBER_WIDTH = 4;
/** indent + number + space + pipe + space + marker + space */
const BODY_PREFIX = BODY_INDENT + NUMBER_WIDTH + 1 + 1 + 1 + 1 + 1;

/**
 * The status row.
 *
 * Built by hand rather than with <Row> because the two halves need different
 * truncation: the stat on the right is never dropped, and the path is clipped
 * from the left so the file name — the part that identifies it — stays visible.
 */
function HeaderRow({
  edit,
  color,
  stat,
  width,
}: {
  edit: FileEdit;
  color: string;
  stat: string;
  width: number;
}) {
  const label = ACTION_LABEL[edit.action];
  const glyph = edit.action === "deleted" ? GLYPH.removed : GLYPH.toolDone;

  // "  " + glyph + " " + label + "  "
  const used = 2 + 1 + 1 + label.length + 2;
  const pathBudget = Math.max(4, width - used - (stat ? stat.length + 2 : 0));
  const path = fitPath(shortenPath(edit.path), pathBudget);

  const gap = stat ? Math.max(1, width - used - path.length - stat.length) : 0;

  return (
    <Box width={width}>
      <Text wrap="truncate-end">
        <Text>{"  "}</Text>
        <Text color={color} bold>
          {glyph}
        </Text>
        <Text> </Text>
        <Text color={color}>{label}</Text>
        <Text>{"  "}</Text>
        <Text color={COLOR.text}>{path}</Text>
        {stat ? (
          <>
            <Text>{" ".repeat(gap)}</Text>
            <Text color={color}>{stat}</Text>
          </>
        ) : null}
      </Text>
    </Box>
  );
}

function DiffRow({ line, width }: { line: DiffLine; width: number }) {
  const marker =
    line.kind === "add" ? GLYPH.added : line.kind === "del" ? GLYPH.removed : " ";
  const color =
    line.kind === "add" ? COLOR.success : line.kind === "del" ? COLOR.error : COLOR.textDim;

  const lineNo = line.kind === "del" ? line.oldNo : line.newNo;
  const numText = String(lineNo ?? "").padStart(NUMBER_WIDTH);

  // Tabs would desynchronise the columns; render them as fixed-width spaces.
  // clamp, not truncate: collapsing whitespace destroys the indentation that
  // makes the change readable in the first place.
  const text = clamp(line.text.replace(/\t/g, "  "), Math.max(4, width - BODY_PREFIX));

  return (
    <Box width={width}>
      <Text wrap="truncate-end">
        <Text>{" ".repeat(BODY_INDENT)}</Text>
        <Text color={COLOR.muted} dimColor>
          {numText}{" "}
        </Text>
        <Text color={COLOR.border} dimColor>
          {GLYPH.pipe}{" "}
        </Text>
        <Text color={color} bold={line.kind !== "ctx"}>
          {marker}{" "}
        </Text>
        <Text color={color} dimColor={line.kind === "ctx"}>
          {text}
        </Text>
      </Text>
    </Box>
  );
}

/**
 * Marks a jump in line numbers. A condensed diff drops unchanged regions, so
 * two adjacent rows can be hundreds of lines apart; without this the block
 * reads as one continuous run of code that exists nowhere in the file.
 */
function HunkBreak({ width }: { width: number }) {
  return (
    <Box width={width}>
      <Text wrap="truncate-end">
        <Text>{" ".repeat(BODY_INDENT)}</Text>
        <Text color={COLOR.muted} dimColor>
          {GLYPH.hunk.padStart(NUMBER_WIDTH)}{" "}
        </Text>
        <Text color={COLOR.border} dimColor>
          {GLYPH.pipe}
        </Text>
      </Text>
    </Box>
  );
}

/** Aligned continuation row used for the "N more changed lines" footer. */
function BodyNote({ text, width }: { text: string; width: number }) {
  return (
    <Box width={width}>
      <Text wrap="truncate-end">
        <Text>{" ".repeat(BODY_INDENT)}</Text>
        <Text color={COLOR.border} dimColor>
          {" ".repeat(NUMBER_WIDTH)} {GLYPH.pipe}{" "}
        </Text>
        <Text color={COLOR.muted} dimColor>
          {clamp(text, Math.max(4, width - BODY_PREFIX))}
        </Text>
      </Text>
    </Box>
  );
}

/** The line number a row occupies in the new file, for gap detection. */
function rowNumber(line: DiffLine): number | undefined {
  return line.newNo ?? line.oldNo;
}

export function FileChangeView({
  edit,
  width,
  maxDiffLines,
}: {
  edit: FileEdit;
  width: number;
  /** Overrides the stored diff length, used to fit a constrained live region. */
  maxDiffLines?: number;
}) {
  const safeWidth = Math.max(24, width);
  const color = actionColor(edit.action);

  // A directory has no contents to diff, so the "+0 -0" summary that
  // `formatDiffStat` produces ("no changes") was actively misleading.
  const stat =
    edit.kind === "directory"
      ? "directory"
      : edit.action === "deleted"
        ? "removed"
        : edit.added === undefined && edit.removed === undefined
          ? ""
          : formatDiffStat(edit.added ?? 0, edit.removed ?? 0);

  const diff = edit.diff ?? [];
  const shown = maxDiffLines === undefined ? diff : diff.slice(0, Math.max(0, maxDiffLines));
  const hiddenCount = diff.length - shown.length;

  return (
    <Box flexDirection="column" width={safeWidth}>
      <HeaderRow edit={edit} color={color} stat={stat} width={safeWidth} />

      {shown.length > 0 && (
        <Box flexDirection="column" width={safeWidth}>
          {shown.map((line, i) => {
            const previous = i > 0 ? rowNumber(shown[i - 1]) : undefined;
            const current = rowNumber(line);
            const gap =
              previous !== undefined && current !== undefined && current > previous + 1;

            return (
              <React.Fragment key={`${i}-${line.kind}`}>
                {gap && <HunkBreak width={safeWidth} />}
                <DiffRow line={line} width={safeWidth} />
              </React.Fragment>
            );
          })}

          {(hiddenCount > 0 || edit.truncated) && (
            <BodyNote
              text={
                hiddenCount > 0
                  ? `${hiddenCount} more changed line${hiddenCount === 1 ? "" : "s"}`
                  : "…"
              }
              width={safeWidth}
            />
          )}
        </Box>
      )}
    </Box>
  );
}
