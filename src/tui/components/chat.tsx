import React from "react";
import { Box, Text } from "ink";
import { MarkdownText } from "./markdown.js";
import { ThoughtBlock } from "./thinking.js";
import { Spinner } from "./spinner.js";
import { Row } from "./row.js";
import { FileChangeView } from "./file-change.js";
import { COLOR, GLYPH, truncate } from "../theme.js";
import type { ChatMessage, FileEdit } from "../state.js";

/**
 * Transcript rendering.
 *
 * The layout is deliberately flat: a one-cell marker column and a content
 * column, no borders around messages. Boxing every message meant every turn
 * added four border rows and a hard width, and any width miscalculation drew a
 * border straight through the text. A gutter cannot collide with anything.
 */

const INDENT = 2;

function Gutter({ glyph, color }: { glyph: string; color: string }) {
  return (
    <Box width={INDENT} flexShrink={0}>
      <Text color={color} bold>
        {glyph}
      </Text>
    </Box>
  );
}

function UserMessage({ message, width }: { message: ChatMessage; width: number }) {
  const contentWidth = Math.max(12, width - INDENT);
  return (
    <Box flexDirection="column" width={width}>
      <Box flexDirection="row">
        <Text color={COLOR.user}>{GLYPH.user} </Text>
        <Text color={COLOR.user} bold>
          You
        </Text>
      </Box>

      <Box flexDirection="row" width={width}>
        <Box width={INDENT} flexShrink={0} />
        <Box flexDirection="column" width={contentWidth}>
          <Text color={COLOR.text} wrap="wrap">
            {message.content}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

function AssistantMessage({ message, width }: { message: ChatMessage; width: number }) {
  const contentWidth = Math.max(12, width - INDENT);
  return (
    <Box flexDirection="column" width={width}>
      <Box flexDirection="row">
        <Text color={COLOR.assistant}>{GLYPH.assistant} </Text>
        <Text color={COLOR.assistant} bold>
          {message.modelName ?? "assistant"}
        </Text>
      </Box>

      <Box flexDirection="row" width={width}>
        <Box width={INDENT} flexShrink={0} />
        <Box flexDirection="column" width={contentWidth}>
          <MarkdownText content={message.content} width={contentWidth} />
        </Box>
      </Box>
      {/*
        No per-turn file summary here. Every write already appears as its own
        transcript entry with an inline diff, so summarising again reported the
        same change twice with two different sets of numbers.
      */}
    </Box>
  );
}

/**
 * A tool that is currently executing. Rendered in the live frame only — never
 * committed to the static transcript, where an animated spinner would freeze.
 */
export function ActiveToolRow({
  name,
  detail,
  width,
}: {
  name: string;
  detail?: string;
  width: number;
}) {
  return (
    <Box flexDirection="row" width={width}>
      <Box width={INDENT} flexShrink={0}>
        <Spinner color={COLOR.tool} />
      </Box>
      <Text wrap="truncate-end">
        <Text color={COLOR.tool}>{name}</Text>
        {detail ? (
          <Text color={COLOR.textDim}>
            {" "}
            {truncate(detail, Math.max(0, width - INDENT - name.length - 2))}
          </Text>
        ) : null}
      </Text>
    </Box>
  );
}

function ToolMessage({ message, width }: { message: ChatMessage; width: number }) {
  const status = message.toolStatus ?? "done";
  const color = status === "error" ? COLOR.error : COLOR.success;
  const name = message.toolName ?? "tool";
  const detail = message.toolDetail ?? "";

  return (
    <Row
      glyph={status === "error" ? GLYPH.toolFail : GLYPH.toolDone}
      glyphColor={color}
      label={name}
      labelColor={COLOR.text}
      value={detail}
      valueColor={status === "error" ? COLOR.error : COLOR.muted}
      width={width}
    />
  );
}

function FileChangeMessage({ message, width }: { message: ChatMessage; width: number }) {
  // Prefer the rich record; fall back to the flat fields for older entries.
  const edit: FileEdit =
    message.fileEdit ??
    ({
      path: message.filePath ?? message.content,
      action: message.fileAction ?? "modified",
    } satisfies FileEdit);

  return <FileChangeView edit={edit} width={width} />;
}

function SystemMessage({ message, width }: { message: ChatMessage; width: number }) {
  const isError = /^error/i.test(message.content);
  const contentWidth = Math.max(12, width - INDENT);
  return (
    <Box flexDirection="row" width={width}>
      <Gutter glyph={isError ? GLYPH.toolFail : GLYPH.system} color={isError ? COLOR.error : COLOR.muted} />
      <Box width={contentWidth}>
        <Text color={isError ? COLOR.error : COLOR.muted} wrap="wrap" dimColor={!isError}>
          {message.content}
        </Text>
      </Box>
    </Box>
  );
}

/** Renders one transcript entry. Every branch is width-bounded. */
export function MessageView({ message, width }: { message: ChatMessage; width: number }) {
  switch (message.role) {
    case "user":
      return <UserMessage message={message} width={width} />;
    case "assistant":
      return <AssistantMessage message={message} width={width} />;
    case "thinking":
      return <ThoughtBlock durationMs={message.thinkingMs} width={width} />;
    case "tool":
      return <ToolMessage message={message} width={width} />;
    case "file-change":
      return <FileChangeMessage message={message} width={width} />;
    case "system":
      return <SystemMessage message={message} width={width} />;
    default:
      return null;
  }
}

/**
 * Returns the last `maxLines` lines of streamed markdown, reopening a code
 * fence if the cut landed inside one.
 *
 * The live region must never be taller than the space reserved for it: an ink
 * frame taller than the terminal cannot be diffed correctly and tears. Once a
 * turn completes the full text moves into the static transcript, so nothing is
 * lost by clipping here.
 */
export function tailLines(content: string, maxLines: number): { text: string; clipped: boolean } {
  if (maxLines <= 0) return { text: "", clipped: content.length > 0 };

  const lines = content.split("\n");
  if (lines.length <= maxLines) return { text: content, clipped: false };

  const kept = lines.slice(lines.length - maxLines);

  // Count fences in the dropped part; an odd count means we cut inside a block.
  const dropped = lines.slice(0, lines.length - maxLines);
  const fenceCount = dropped.filter((l) => /^\s*```/.test(l)).length;
  const text = fenceCount % 2 === 1 ? "```\n" + kept.join("\n") : kept.join("\n");

  return { text, clipped: true };
}

/**
 * The in-progress assistant turn. Lives in the live frame (not the static
 * transcript) and is clipped to `maxLines`.
 */
export function LiveMessage({
  content,
  modelName,
  width,
  maxLines,
}: {
  content: string;
  modelName: string;
  width: number;
  maxLines: number;
}) {
  if (!content.trim()) return null;

  const contentWidth = Math.max(12, width - INDENT);
  const { text, clipped } = tailLines(content, maxLines);

  return (
    <Box flexDirection="column" width={width}>
      <Box flexDirection="row">
        <Text color={COLOR.assistant}>{GLYPH.assistant} </Text>
        <Text color={COLOR.assistant} bold>
          {modelName}
        </Text>
      </Box>

      {clipped && (
        <Box flexDirection="row" width={width}>
          <Box width={INDENT} flexShrink={0} />
          <Text color={COLOR.muted} dimColor>
            … earlier output scrolls up when complete
          </Text>
        </Box>
      )}

      <Box flexDirection="row" width={width}>
        <Box width={INDENT} flexShrink={0} />
        <Box flexDirection="column" width={contentWidth}>
          <MarkdownText content={text} width={contentWidth} />
        </Box>
      </Box>
    </Box>
  );
}

/** Shown once, before the first turn. */
export function EmptyState({ width }: { width: number }) {
  return (
    <Box flexDirection="column" width={width}>
      <Text color={COLOR.muted} dimColor wrap="truncate-end">
        Ask a question, describe a change, or press ctrl+p for commands.
      </Text>
    </Box>
  );
}
