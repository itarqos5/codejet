import React, { useState, useEffect, useRef } from "react";
import { Box, Text, useInput } from "ink";
import { MarkdownText } from "./markdown.js";
import type { ChatMessage, FileChange } from "../state.js";

function ToolCallDisplay({ message }: { message: ChatMessage }) {
  return (
    <Box gap={1} paddingX={1}>
      <Text color="magenta" bold>⚡</Text>
      <Text color="magenta">
        Calling <Text bold color="white">{message.content}</Text>
      </Text>
    </Box>
  );
}

function ToolResultDisplay({ message }: { message: ChatMessage }) {
  const columns = process.stdout.columns ?? 80;
  const maxPreviewWidth = Math.min(60, columns - 20);
  
  const truncateContent = (text: string, maxLen: number): string => {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen - 3) + "...";
  };
  
  const preview = truncateContent(message.content, maxPreviewWidth);
  const isTruncated = message.content.length > maxPreviewWidth;
  
  return (
    <Box flexDirection="column" paddingLeft={2} gap={0}>
      <Text color="gray" dimColor>──┤ Result ├────────────────</Text>
      <Box flexDirection="column" paddingX={1}>
        <Text color="cyan">{preview}</Text>
        {isTruncated && (
          <Text color="gray" dimColor>
            ({(message.content.length - maxPreviewWidth + 3)} more chars hidden)
          </Text>
        )}
      </Box>
    </Box>
  );
}

function FileChangeDisplay({ message }: { message: ChatMessage }) {
  const icon = message.fileAction === "created" ? "◎" : message.fileAction === "deleted" ? "✕" : "◉";
  const color = message.fileAction === "created" ? "green" : message.fileAction === "deleted" ? "red" : "yellow";
  return (
    <Box gap={1} paddingX={1}>
      <Text color={color} bold>{icon}</Text>
      <Text color={color}>
        {message.fileAction}{" "}
        <Text bold color="white">{message.filePath}</Text>
      </Text>
    </Box>
  );
}

function UserMessage({ message }: { message: ChatMessage }) {
  const columns = process.stdout.columns ?? 80;
  const maxWidth = Math.min(columns - 8, 76);
  const contentWidth = Math.max(20, maxWidth - 4);
  
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="blue" paddingX={1} paddingY={0} marginBottom={1}>
      <Box gap={1}>
        <Text color="blue" bold>▸</Text>
        <Text color="blue" bold>User</Text>
      </Box>
      <Box paddingLeft={2} width={contentWidth}>
        <MarkdownText content={message.content} maxWidth={contentWidth} />
      </Box>
    </Box>
  );
}

function AssistantMessage({ message }: { message: ChatMessage }) {
  const columns = process.stdout.columns ?? 80;
  const maxWidth = Math.min(columns - 8, 76);
  const contentWidth = Math.max(20, maxWidth - 4);
  
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} paddingY={0} marginBottom={1}>
      <Box gap={1}>
        <Text color="cyan" bold>◈</Text>
        <Text color="cyan" bold>{message.modelName ?? "assistant"}</Text>
      </Box>
      <Box paddingLeft={2} width={contentWidth}>
        <MarkdownText content={message.content} maxWidth={contentWidth} />
      </Box>
      {message.fileChanges && message.fileChanges.length > 0 && (
        <Box flexDirection="column" paddingTop={1} paddingLeft={2}>
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
        <Box flexDirection="column" paddingTop={1} paddingLeft={2}>
          {message.toolCalls.map((tool, i) => (
            <Text key={i} color="gray" dimColor>⚡ {tool}</Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

function SystemMessage({ message }: { message: ChatMessage }) {
  return (
    <Box paddingLeft={2} paddingY={0}>
      <Text color="gray" dimColor italic>
        ℹ {message.content}
      </Text>
    </Box>
  );
}

function StreamingMessage({ content, model }: { content: string; model: string }) {
  const columns = process.stdout.columns ?? 80;
  const maxWidth = Math.min(columns - 8, 76);
  const contentWidth = Math.max(20, maxWidth - 4);
  
  if (!content) return null;
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="#00ff88" paddingX={1} paddingY={0} marginBottom={1}>
      <Box gap={1}>
        <Text color="#00ff88" bold>◉</Text>
        <Text color="#00ff88" bold>{model}</Text>
        <Text color="gray" dimColor>streaming...</Text>
      </Box>
      <Box paddingLeft={2} width={contentWidth}>
        <MarkdownText content={content} maxWidth={contentWidth} />
      </Box>
      {/* Animated cursor */}
      <Box>
        <Text color="#00ff88" bold>▋</Text>
      </Box>
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
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isScrolling) {
      setScrollOffset(0);
    }
  }, [messages.length, streamingContent, isScrolling]);

  // Auto-scroll to bottom when new messages arrive (unless user is scrolling)
  useEffect(() => {
    if (!isScrolling && messages.length > 0) {
      setScrollOffset(0);
    }
  }, [messages.length, streamingContent]);

  useInput((input, key) => {
    // Enable scroll mode with Shift+Up/Down
    if (key.upArrow && input === "") {
      setIsScrolling(true);
      setScrollOffset((prev) => {
        const maxOffset = Math.max(0, messages.length - maxHeight + (streaming ? 1 : 0));
        return Math.min(prev + 1, maxOffset);
      });
      // Exit scroll mode after inactivity
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => setIsScrolling(false), 3000);
    } else if (key.downArrow && input === "") {
      setIsScrolling(true);
      setScrollOffset((prev) => Math.max(0, prev - 1));
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => setIsScrolling(false), 3000);
    } else if (key.pageUp) {
      setIsScrolling(true);
      setScrollOffset((prev) => {
        const maxOffset = Math.max(0, messages.length - maxHeight + (streaming ? 1 : 0));
        return Math.min(prev + maxHeight, maxOffset);
      });
    } else if (key.pageDown) {
      setIsScrolling(true);
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

  // Calculate scroll percentage for progress bar
  const scrollPercent = maxScroll > 0 ? Math.round((effectiveOffset / maxScroll) * 100) : 0;
  const scrollBarWidth = 8;
  const filledBars = Math.round((scrollPercent / 100) * scrollBarWidth);
  const scrollBar = "▓".repeat(filledBars) + "░".repeat(scrollBarWidth - filledBars);

  return (
    <Box flexDirection="column" overflow="hidden" flexGrow={1}>
      {maxScroll > 0 && effectiveOffset > 0 && (
        <Box justifyContent="center" paddingBottom={0}>
          <Text color="gray" dimColor>
            ↑ {effectiveOffset} more ↑
          </Text>
        </Box>
      )}
      
      {/* Chat messages with scroll bar on the right */}
      <Box flexDirection="row" flexGrow={1}>
        <Box flexDirection="column" flexGrow={1} overflow="hidden">
          {visibleItems.map((msg) => renderMessage(msg))}
        </Box>
        
        {/* Scroll position indicator */}
        {maxScroll > 0 && (
          <Box flexDirection="column" justifyContent="center" paddingX={0}>
            <Text color="cyan" dimColor>{scrollBar}</Text>
          </Box>
        )}
      </Box>
      
      {messages.length === 0 && !streaming && (
        <Box flexDirection="column" justifyContent="center" flexGrow={1} gap={1}>
          <Box justifyContent="center">
            <Text color="cyan" bold>◆</Text>
            <Text color="gray" dimColor> </Text>
            <Text color="gray">Ready for your command</Text>
          </Box>
          <Box justifyContent="center" gap={2}>
            <Text color="gray" dimColor>Tab</Text>
            <Text color="gray">switch mode</Text>
            <Text color="gray" dimColor>│</Text>
            <Text color="gray" dimColor>Ctrl+P</Text>
            <Text color="gray">commands</Text>
          </Box>
        </Box>
      )}
      
      {maxScroll > 0 && effectiveOffset > 0 && effectiveOffset < maxScroll && (
        <Box justifyContent="center" paddingTop={0}>
          <Text color="gray" dimColor>
            ↓ {maxScroll - effectiveOffset} more below ↓
          </Text>
        </Box>
      )}
    </Box>
  );
}
