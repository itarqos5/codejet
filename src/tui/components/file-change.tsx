import React from "react";
import { Box, Text } from "ink";
import { COLOR, GLYPH } from "../theme.js";
import { Row } from "./row.js";
import { formatDiffStat, type DiffLine } from "../../api/diff.js";
import type { FileEdit } from "../state.js";

/**
 * Renders a file the agent created, edited or deleted.
 *
 * The header is an installer-style aligned row (action + path on the left, the
 * `+n -n` stat on the right) and, when a diff is available, the changed lines
 * follow in a gutter-marked block. Line numbers come from the diff itself so a
 * condensed diff still points at the right place in the file.
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

function DiffRow({ line, width }: { line: DiffLine; width: number }) {
  const marker = line.kind === "add" ? "+" : line.kind === "del" ? "-" : " ";
  const color =
    line.kind === "add" ? COLOR.success : line.kind === "del" ? COLOR.error : COLOR.muted;

  // Gutter: 4 spaces, bar, space, line number (4), space, marker, space
  const lineNo = line.kind === "del" ? line.oldNo : line.newNo;
  const numText = String(lineNo ?? "").padStart(4);
  const prefixWidth = 4 + 2 + numText.length + 1 + 2;
  const textBudget = Math.max(4, width - prefixWidth);

  // Tabs would desynchronise the columns; render them as spaces.
  const text = line.text.replace(/\t/g, "  ").slice(0, textBudget);

  return (
    <Box width={width}>
      <Text wrap="truncate-end">
        <Text>{"    "}</Text>
        <Text color={COLOR.border} dimColor>
          {GLYPH.gutter}{" "}
        </Text>
        <Text color={COLOR.muted} dimColor>
          {numText}{" "}
        </Text>
        <Text color={color} bold={line.kind !== "ctx"}>
          {marker}{" "}
        </Text>
        <Text color={line.kind === "ctx" ? COLOR.textDim : color} dimColor={line.kind === "ctx"}>
          {text}
        </Text>
      </Text>
    </Box>
  );
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
  const color = actionColor(edit.action);
  const stat =
    edit.action === "deleted"
      ? "removed"
      : formatDiffStat(edit.added ?? 0, edit.removed ?? 0);

  const diff = edit.diff ?? [];
  const shown = maxDiffLines === undefined ? diff : diff.slice(0, Math.max(0, maxDiffLines));
  const hiddenCount = diff.length - shown.length;

  return (
    <Box flexDirection="column" width={width}>
      <Row
        glyph={edit.action === "deleted" ? GLYPH.toolFail : GLYPH.toolDone}
        glyphColor={color}
        label={`${ACTION_LABEL[edit.action]}  ${edit.path}`}
        labelColor={COLOR.text}
        value={stat}
        valueColor={color}
        width={width}
      />

      {shown.length > 0 && (
        <Box flexDirection="column" width={width}>
          {shown.map((line, i) => (
            <DiffRow key={i} line={line} width={width} />
          ))}

          {(edit.truncated || hiddenCount > 0) && (
            <Box width={width}>
              <Text color={COLOR.muted} dimColor wrap="truncate-end">
                {"    "}
                {GLYPH.gutter} {hiddenCount > 0 ? `${hiddenCount} more changed lines` : "…"}
              </Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
