import React, { useRef, useEffect } from "react";
import { Box, Text } from "ink";
import type { ChatMessage } from "../state.js";

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
    <Box flexDirection="column" gap={0}>
      <Text color="white" bold>
        you
      </Text>
      <Box paddingLeft={2}>
        <Text>{message.content}</Text>
      </Box>
    </Box>
  );
}

function AssistantMessage({ message }: { message: ChatMessage }) {
  return (
    <Box flexDirection="column" gap={0}>
      <Text color="cyan" bold>
        {message.modelName ?? "assistant"}
      </Text>
      <Box paddingLeft={2}>
        <Text>{message.content}</Text>
      </Box>
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
    <Box flexDirection="column" gap={0}>
      <Text color="cyan" bold>
        {model}
        <Text color="gray" dimColor>
          {" "}streaming...
        </Text>
      </Text>
      <Box paddingLeft={2}>
        <Text>{content}</Text>
      </Box>
    </Box>
  );
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
  const scrollRef = useRef<number>(0);

  useEffect(() => {
    scrollRef.current = messages.length;
  }, [messages.length]);

  const visibleMessages = messages.slice(-maxHeight);

  return (
    <Box flexDirection="column" overflow="hidden" flexGrow={1}>
      {visibleMessages.map((msg) => {
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
      })}
      {streaming && <StreamingMessage content={streamingContent} model={modelName} />}
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
