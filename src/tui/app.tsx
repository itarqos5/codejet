import React, { useReducer, useCallback, useEffect, useState } from "react";
import { Box, Text, useInput, useApp, useStdin } from "ink";
import { Header } from "./components/header.js";
import { ChatArea } from "./components/chat.js";
import { InputBox } from "./components/input.js";
import { StatusBar } from "./components/statusbar.js";
import { CommandModal, ModelSelector } from "./components/modal.js";
import { TodoPanel } from "./components/todo.js";
import { QuestionPrompt } from "./components/question.js";
import { FileNotification } from "./components/file-notification.js";
import { appReducer, INITIAL_STATE, type ChatMessage } from "./state.js";
import { FREE_MODELS, getModelById } from "./models.js";
import { loadKeys } from "../api/keys.js";

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export default function App() {
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE);
  const { exit } = useApp();
  const { isRawModeSupported, setRawMode } = useStdin();
  const [modalMode, setModalMode] = useState<"none" | "command" | "model">("none");
  const [modalIndex, setModalIndex] = useState(0);
  const [fileNotifications, setFileNotifications] = useState<
    { filePath: string; action: "created" | "modified" | "deleted" }[]
  >([]);

  const currentModel = getModelById(state.modelId);

  // Load todos from disk on mount
  useEffect(() => {
    import("../tools/todo.js")
      .then(async (mod) => {
        const todos = await (mod as { loadTodos: () => Promise<unknown> }).loadTodos?.() ?? [];
        dispatch({ type: "SET_TODOS", todos: todos as import("./state.js").AppState["todos"] });
      })
      .catch(() => {});
  }, []);

  // Keyboard shortcuts
  useInput((input, key) => {
    // Ctrl+P - toggle command palette
    if (key.ctrl && input === "p") {
      if (state.pendingQuestion) return;
      setModalMode((prev) => (prev === "command" ? "none" : "command"));
      setModalIndex(0);
      return;
    }

    // Escape - close modals
    if (key.escape) {
      if (modalMode !== "none") {
        setModalMode("none");
        return;
      }
      return;
    }

    // Tab - toggle mode (only when no modal is open)
    if (key.tab && modalMode === "none" && !state.pendingQuestion) {
      dispatch({
        type: "SET_MODE",
        mode: state.mode === "build" ? "plan" : "build",
      });
      return;
    }

    // Modal navigation
    if (modalMode === "command") {
      if (key.upArrow) {
        setModalIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setModalIndex((prev) => Math.min(4, prev + 1));
      } else if (key.return) {
        handleCommandAction(["new", "model", "compact", "todos", "clear"][modalIndex]);
        setModalMode("none");
      }
      return;
    }

    if (modalMode === "model") {
      if (key.upArrow) {
        setModalIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setModalIndex((prev) => Math.min(FREE_MODELS.length - 1, prev + 1));
      } else if (key.return) {
        const model = FREE_MODELS[modalIndex];
        if (model) {
          dispatch({ type: "SET_MODEL", modelId: model.id });
          dispatch({ type: "SET_CONTEXT_TOKENS", used: 0, max: model.maxContext });
        }
        setModalMode("none");
      }
      return;
    }
  });

  const handleCommandAction = useCallback(
    (action: string) => {
      switch (action) {
        case "new":
          dispatch({ type: "CLEAR_MESSAGES" });
          break;
        case "model":
          setModalMode("model");
          setModalIndex(0);
          break;
        case "compact":
          // TODO: implement compaction
          break;
        case "clear":
          dispatch({ type: "CLEAR_MESSAGES" });
          break;
        case "todos":
          // TODO: show todos
          break;
      }
    },
    [],
  );

  const handleSendMessage = useCallback(
    async (content: string) => {
      const userMsg: ChatMessage = {
        id: genId(),
        role: "user",
        content,
        timestamp: Date.now(),
      };
      dispatch({ type: "ADD_MESSAGE", message: userMsg });
      dispatch({ type: "SET_STREAMING", streaming: true });
      dispatch({ type: "SET_STREAMING_CONTENT", content: "" });

      try {
        const keys = loadKeys();

        // Try Kilo Code first
        if (keys.kilo_token) {
          const { chatCompletionsStream } = await import("../api/kilocode.js");
          const stream = await chatCompletionsStream({
            model: state.modelId,
            messages: [
              {
                role: "system",
                content:
                  "You are CodeJet, an AI coding assistant. You help users with software engineering tasks. When you need to ask the user a question, use the ask tool. When you create or modify files, describe what you did.",
              },
              ...state.messages.map((m) => ({
                role: m.role === "user" ? ("user" as const) : ("assistant" as const),
                content: m.content,
              })),
              { role: "user" as const, content },
            ],
            tools: [
              {
                type: "function" as const,
                function: {
                  name: "ask",
                  description: "Ask the user a question",
                  parameters: {
                    type: "object",
                    properties: {
                      question: { type: "string" },
                      options: { type: "array", items: { type: "string" } },
                    },
                    required: ["question"],
                  },
                },
              },
              {
                type: "function" as const,
                function: {
                  name: "write_file",
                  description: "Write content to a file",
                  parameters: {
                    type: "object",
                    properties: {
                      path: { type: "string" },
                      content: { type: "string" },
                    },
                    required: ["path", "content"],
                  },
                },
              },
            ],
          });

          const reader = stream.getReader();
          let fullContent = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const delta = value.choices?.[0]?.delta;
            if (delta?.content) {
              fullContent += delta.content;
              dispatch({ type: "SET_STREAMING_CONTENT", content: fullContent });
            }
            // Handle tool calls
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (tc.function?.name === "ask") {
                  try {
                    const args = JSON.parse(tc.function.arguments);
                    const answer = await new Promise<string>((resolve) => {
                      dispatch({
                        type: "SET_PENDING_QUESTION",
                        question: {
                          id: genId(),
                          question: args.question,
                          options: args.options,
                          resolve,
                        },
                      });
                    });
                    dispatch({ type: "SET_PENDING_QUESTION", question: null });
                  } catch {}
                }
                if (tc.function?.name === "write_file") {
                  try {
                    const args = JSON.parse(tc.function.arguments);
                    setFileNotifications((prev) => [
                      ...prev,
                      { filePath: args.path, action: "created" as const },
                    ]);
                  } catch {}
                }
              }
            }
          }

          if (fullContent) {
            const assistantMsg: ChatMessage = {
              id: genId(),
              role: "assistant",
              content: fullContent,
              timestamp: Date.now(),
              modelName: currentModel?.name,
            };
            dispatch({ type: "ADD_MESSAGE", message: assistantMsg });

            // Estimate context usage
            const estimatedTokens = state.contextTokensUsed + fullContent.length / 4 + content.length / 4;
            dispatch({
              type: "SET_CONTEXT_TOKENS",
              used: Math.round(estimatedTokens),
              max: currentModel?.maxContext ?? 131072,
            });
          }
        }
        // Fallback to OpenCode
        else {
          const opencode = await import("../api/opencode.js");
          const assistantMsg: ChatMessage = {
            id: genId(),
            role: "assistant",
            content: "[OpenCode integration - connect to your OpenCode server to use this model]",
            timestamp: Date.now(),
            modelName: currentModel?.name,
          };
          dispatch({ type: "ADD_MESSAGE", message: assistantMsg });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        dispatch({ type: "SET_ERROR", error: errorMsg });
        const errChatMsg: ChatMessage = {
          id: genId(),
          role: "system",
          content: `Error: ${errorMsg}`,
          timestamp: Date.now(),
        };
        dispatch({ type: "ADD_MESSAGE", message: errChatMsg });
      } finally {
        dispatch({ type: "SET_STREAMING", streaming: false });
      }
    },
    [state.modelId, state.messages, state.contextTokensUsed, currentModel],
  );

  // Clear old file notifications
  useEffect(() => {
    if (fileNotifications.length > 0) {
      const timer = setTimeout(() => {
        setFileNotifications((prev) => prev.slice(1));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [fileNotifications.length]);

  return (
    <Box flexDirection="column" height="100%">
      <Header model={currentModel?.name ?? state.modelId} mode={state.mode} />

      <Box flexDirection="row" flexGrow={1} overflow="hidden">
        <Box flexDirection="column" flexGrow={1} overflow="hidden">
          <ChatArea
            messages={state.messages}
            streaming={state.streaming}
            streamingContent={state.streamingContent}
            modelName={currentModel?.name ?? "assistant"}
            maxHeight={20}
          />

          {fileNotifications.map((n, i) => (
            <FileNotification key={i} filePath={n.filePath} action={n.action} />
          ))}

          {state.pendingQuestion && (
            <QuestionPrompt
              question={state.pendingQuestion}
              onAnswer={(answer) => {
                state.pendingQuestion?.resolve(answer);
                dispatch({ type: "SET_PENDING_QUESTION", question: null });
              }}
            />
          )}

          {state.error && (
            <Box paddingLeft={2}>
              <Text color="red" bold>
                Error: {state.error}
              </Text>
            </Box>
          )}

          <InputBox
            mode={state.mode}
            onSubmit={handleSendMessage}
            onFocus={() => dispatch({ type: "SET_INPUT_FOCUSED", focused: true })}
            disabled={state.streaming || !!state.pendingQuestion}
          />
        </Box>

        {state.todos.length > 0 && (
          <Box paddingLeft={1}>
            <TodoPanel todos={state.todos} />
          </Box>
        )}
      </Box>

      <StatusBar
        mode={state.mode}
        modelId={state.modelId}
        contextUsed={state.contextTokensUsed}
        contextMax={state.contextTokensMax}
        streaming={state.streaming}
        todoCount={state.todos.length}
      />

      <CommandModal
        visible={modalMode === "command"}
        selectedIndex={modalIndex}
        onSelect={handleCommandAction}
        onClose={() => setModalMode("none")}
      />

      <ModelSelector
        visible={modalMode === "model"}
        models={FREE_MODELS.map((m) => ({ id: m.id, name: m.name, provider: m.provider }))}
        selectedIndex={modalIndex}
        onSelect={(modelId) => {
          dispatch({ type: "SET_MODEL", modelId });
          const model = getModelById(modelId);
          if (model) {
            dispatch({ type: "SET_CONTEXT_TOKENS", used: 0, max: model.maxContext });
          }
          setModalMode("none");
        }}
        onClose={() => setModalMode("none")}
      />
    </Box>
  );
}
