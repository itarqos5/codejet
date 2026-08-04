import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { MarkdownText } from "./markdown.js";
import type { ChatMessage, FileChange } from "../state.js";

function ToolCallDisplay({ message }: { message: ChatMessage }) {
  return (
    <Box gap={1}>
      <Text color="magenta" bold>
        ⚙
      </Text>
      <Text color="magenta">
        Calling <Text bold>{message.content}</Text>
      </Text>
    </Box>
  );
}

function ToolResultDisplay({ message }: { message: ChatMessage }) {
  const preview = message.content.length > 200
    ? message.content.slice(0, 200) + "..."
    : message.content;
  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Text color="gray" dimColor>
        Result:
      </Text>
      <Text color="gray">{preview}</Text>
    </Box>
  );
}

function FileChangeDisplay({ message }: { message: ChatMessage }) {
  const icon = message.fileAction === "created" ? "+" : message.fileAction === "deleted" ? "-" : "~";
  const color = message.fileAction === "created" ? "green" : message.fileAction === "deleted" ? "red" : "yellow";
  return (
    <Box gap={1}>
      <Text color={color} bold>
        [{icon}]
      </Text>
      <Text color={color}>
        {message.fileAction}{" "}
        <Text bold>{message.filePath}</Text>
      </Text>
    </Box>
  );
}

function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="blue" paddingX={1} marginBottom={1}>
      <Text color="blue" bold>
        User
      </Text>
      <MarkdownText content={message.content} />
    </Box>
  );
}

function AssistantMessage({ message }: { message: ChatMessage }) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginBottom={1}>
      <Text color="cyan" bold>
        {message.modelName ?? "assistant"}
      </Text>
      <MarkdownText content={message.content} />
      {message.fileChanges && message.fileChanges.length > 0 && (
        <Box flexDirection="column" paddingTop={1}>
          {message.fileChanges.map((fc, i) => (
            <Box key={i} gap={1}>
              {fc.added > 0 && <Text color="green">+{fc.added}</Text>}
              {fc.removed > 0 && <Text color="red">-{fc.removed}</Text>}
              <Text color="gray">{fc.path}</Text>
            </Box>
          ))}
        </Box>
      )}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <Box flexDirection="column" paddingTop={1}>
          {message.toolCalls.map((tool, i) => (
            <Text key={i} color="gray" dimColor>
              Model ran tool: {tool}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

function SystemMessage({ message }: { message: ChatMessage }) {
  return (
    <Box paddingLeft={2}>
      <Text color="gray" dimColor italic>
        {message.content}
      </Text>
    </Box>
  );
}

function StreamingMessage({ content, model }: { content: string; model: string }) {
  if (!content) return null;
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginBottom={1}>
      <Text color="cyan" bold>
        {model}
        <Text color="gray" dimColor>
          {" "}streaming...
        </Text>
      </Text>
      <MarkdownText content={content} />
    </Box>
  );
}

function renderMessage(msg: ChatMessage) {
  switch (msg.role) {
    case "user":
      return <UserMessage key={msg.id} message={msg} />;
    case "assistant":
      return <AssistantMessage key={msg.id} message={msg} />;
    case "system":
      return <SystemMessage key={msg.id} message={msg} />;
    case "tool-call":
      return <ToolCallDisplay key={msg.id} message={msg} />;
    case "tool-result":
      return <ToolResultDisplay key={msg.id} message={msg} />;
    case "file-change":
      return <FileChangeDisplay key={msg.id} message={msg} />;
    default:
      return null;
  }
}

export function ChatArea({
  messages,
  streaming,
  streamingContent,
  modelName,
  maxHeight,
}: {
  messages: ChatMessage[];
  streaming: boolean;
  streamingContent: string;
  modelName: string;
  maxHeight: number;
}) {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);

  useEffect(() => {
    if (!isScrolling) {
      setScrollOffset(0);
    }
  }, [messages.length, streamingContent, isScrolling]);

  useInput((input, key) => {
    if (!isScrolling) return;

    if (key.upArrow) {
      setScrollOffset((prev) => {
        const maxOffset = Math.max(0, messages.length - maxHeight + (streaming ? 1 : 0));
        return Math.min(prev + 1, maxOffset);
      });
    } else if (key.downArrow) {
      setScrollOffset((prev) => Math.max(0, prev - 1));
    } else if (key.pageUp) {
      setScrollOffset((prev) => {
        const maxOffset = Math.max(0, messages.length - maxHeight + (streaming ? 1 : 0));
        return Math.min(prev + maxHeight, maxOffset);
      });
    } else if (key.pageDown) {
      setScrollOffset((prev) => Math.max(0, prev - maxHeight));
    }
  });

  const totalItems = messages.length + (streaming && streamingContent ? 1 : 0);
  const maxScroll = Math.max(0, totalItems - maxHeight);
  const effectiveOffset = Math.min(scrollOffset, maxScroll);

  const allItems: ChatMessage[] = [...messages];
  if (streaming && streamingContent) {
    allItems.push({
      id: "__streaming__",
      role: "assistant",
      content: streamingContent,
      timestamp: 0,
      modelName,
    });
  }

  const startIdx = Math.max(0, allItems.length - maxHeight - effectiveOffset);
  const visibleItems = allItems.slice(startIdx, startIdx + maxHeight);

  return (
    <Box flexDirection="column" overflow="hidden" flexGrow={1}>
      {maxScroll > 0 && effectiveOffset > 0 && (
        <Box justifyContent="center">
          <Text color="gray" dimColor>
            ↑ {effectiveOffset} more above (↑↓ to scroll, Esc to exit scroll)
          </Text>
        </Box>
      )}
      {visibleItems.map((msg) => renderMessage(msg))}
      {messages.length === 0 && !streaming && (
        <Box justifyContent="center" paddingTop={2}>
          <Text color="gray" dimColor>
            Start a conversation... (Tab to switch mode, Ctrl+P for commands)
          </Text>
        </Box>
      )}
    </Box>
  );
}
