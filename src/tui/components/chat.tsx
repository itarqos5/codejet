import React from "react";
import { Box, Text } from "ink";
import { MarkdownText } from "./markdown.js";
import { ThoughtBlock } from "./thinking.js";
import { Spinner } from "./spinner.js";
import { COLOR, GLYPH, truncate } from "../theme.js";
import type { ChatMessage } from "../state.js";

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
    <Box flexDirection="row" width={width}>
      <Gutter glyph={GLYPH.user} color={COLOR.user} />
      <Box flexDirection="column" width={contentWidth}>
        <Text color={COLOR.text} wrap="wrap">
          {message.content}
        </Text>
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

          {message.fileChanges && message.fileChanges.length > 0 && (
            <Box flexDirection="column" width={contentWidth}>
              {message.fileChanges.map((fc, i) => (
                <Text key={i} wrap="truncate-end">
                  <Text color={COLOR.success}>
                    {GLYPH.added}
                    {fc.added}
                  </Text>
                  <Text color={COLOR.error}>
                    {" "}
                    {GLYPH.removed}
                    {fc.removed}
                  </Text>
                  <Text color={COLOR.textDim}> {truncate(fc.path, contentWidth - 12)}</Text>
                </Text>
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function ToolMessage({ message, width }: { message: ChatMessage; width: number }) {
  const status = message.toolStatus ?? "done";
  const glyph =
    status === "running" ? null : status === "error" ? GLYPH.toolFail : GLYPH.toolDone;
  const color =
    status === "error" ? COLOR.error : status === "running" ? COLOR.tool : COLOR.success;

  const detail = message.toolDetail ?? message.content;
  const nameWidth = (message.toolName ?? "tool").length;
  const detailWidth = Math.max(0, width - INDENT - nameWidth - 2);

  return (
    <Box flexDirection="row" width={width}>
      <Box width={INDENT} flexShrink={0}>
        {glyph ? <Text color={color}>{glyph}</Text> : <Spinner color={COLOR.tool} />}
      </Box>
      <Text wrap="truncate-end">
        <Text color={color}>{message.toolName ?? "tool"}</Text>
        {detail ? <Text color={COLOR.textDim}> {truncate(detail, detailWidth)}</Text> : null}
      </Text>
    </Box>
  );
}

function FileChangeMessage({ message, width }: { message: ChatMessage; width: number }) {
  const action = message.fileAction ?? "modified";
  const color =
    action === "created" ? COLOR.success : action === "deleted" ? COLOR.error : COLOR.warning;
  const label = action.charAt(0).toUpperCase() + action.slice(1);

  return (
    <Box flexDirection="row" width={width}>
      <Gutter glyph={GLYPH.toolDone} color={color} />
      <Text wrap="truncate-end">
        <Text color={color}>{label}</Text>
        <Text color={COLOR.textDim}>
          {" "}
          {truncate(message.filePath ?? message.content, width - INDENT - label.length - 2)}
        </Text>
      </Text>
    </Box>
  );
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
