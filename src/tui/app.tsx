import React, { useReducer, useCallback, useEffect, useState, useRef } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { Header } from "./components/header.js";
import { ChatArea } from "./components/chat.js";
import { InputBox } from "./components/input.js";
import { StatusBar } from "./components/statusbar.js";
import { CommandModal, ModelSelector, buildModelItems } from "./components/modal.js";
import { TodoPanel } from "./components/todo.js";
import { QuestionPrompt } from "./components/question.js";
import { FileNotification } from "./components/file-notification.js";
import { UpdateToast } from "./components/update-toast.js";
import { UpdateModal } from "./components/update-modal.js";
import { appReducer, INITIAL_STATE, type ChatMessage, type FileChange } from "./state.js";
import { getModelById, getModelProvider } from "./models.js";
import { loadKeys } from "../api/keys.js";
import { logSessionErrors, type SessionError } from "../api/logger.js";

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export default function App() {
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE);
  const { exit } = useApp();
  const [modalMode, setModalMode] = useState<"none" | "command" | "model">("none");
  const [modalIndex, setModalIndex] = useState(0);
  const [fileNotifications, setFileNotifications] = useState<
    { filePath: string; action: "created" | "modified" | "deleted" }[]
  >([]);

  const currentModel = getModelById(state.modelId);
  const sessionErrors = useRef<SessionError[]>([]);

  // Start OpenCode server on mount
  useEffect(() => {
    import("../api/opencode-server.js").then((mod) => {
      mod.startServer();
      mod.waitForServer(10000).then((ready) => {
        dispatch({ type: "SET_OPENCODE_READY", ready });
      });
    }).catch(() => {});
  }, []);

  // Check for updates on mount
  useEffect(() => {
    import("../api/updater.js").then((mod) => {
      mod.checkForUpdate().then((info) => {
        if (info) {
          dispatch({ type: "SET_UPDATE_AVAILABLE", version: info.version });
        }
      });
    }).catch(() => {});
  }, []);

  // Keyboard shortcuts
  useInput((input, key) => {
    // Ctrl+C - log errors, clear terminal, exit
    if (key.ctrl && input === "c") {
      logSessionErrors(sessionErrors.current);
      import("../api/opencode-server.js").then((mod) => mod.stopServer()).catch(() => {});
      process.stdout.write("\x1B[2J\x1B[0f");
      exit();
      return;
    }

    // Update flow - Enter to install/update, Esc to dismiss
    if (state.updateAvailable && state.updatePhase === "idle") {
      if (key.return) {
        dispatch({ type: "SET_UPDATE_PHASE", phase: "installing" });
        import("../api/updater.js").then((mod) => {
          mod.installUpdate((line) => {
            dispatch({ type: "SET_UPDATE_PHASE", phase: "installing", log: line });
          }).then((ok) => {
            dispatch({ type: "SET_UPDATE_PHASE", phase: ok ? "done" : "error" });
          });
        });
        return;
      }
      if (key.escape) {
        dispatch({ type: "SET_UPDATE_AVAILABLE", version: null });
        dispatch({ type: "SET_UPDATE_PHASE", phase: "idle" });
        return;
      }
    }
    if (state.updatePhase === "done") {
      if (key.return) {
        import("../api/updater.js").then((mod) => mod.restartApp());
        return;
      }
    }

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
        const action = ["new", "model", "compact", "todos", "clear"][modalIndex];
        handleCommandAction(action);
        if (action !== "model") {
          setModalMode("none");
        }
      }
      return;
    }

    if (modalMode === "model") {
      const items = buildModelItems();
      const selectableIndices = items.map((it, i) => i).filter((i) => items[i].type === "model");
      if (key.upArrow) {
        setModalIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setModalIndex((prev) => Math.min(selectableIndices.length - 1, prev + 1));
      } else if (key.return) {
        const selectedItemIdx = selectableIndices[modalIndex];
        const selected = items[selectedItemIdx];
        if (selected?.model) {
          const provider = getModelProvider(selected.model.id);
          dispatch({ type: "SET_MODEL", modelId: selected.model.id, provider });
          dispatch({ type: "SET_CONTEXT_TOKENS", used: 0, max: selected.model.maxContext });
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
          break;
        case "clear":
          dispatch({ type: "CLEAR_MESSAGES" });
          break;
        case "todos":
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
        const provider = getModelProvider(state.modelId);

        if (provider === "opencode") {
          await handleOpenCodeMessage(content);
        } else {
          await handleKiloMessage(content);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        dispatch({ type: "SET_ERROR", error: errorMsg });
        sessionErrors.current.push({
          timestamp: Date.now(),
          model: currentModel?.name ?? state.modelId,
          message: errorMsg,
        });
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

  async function handleOpenCodeMessage(content: string) {
    const ocServer = await import("../api/opencode-server.js");

    const ready = await ocServer.waitForServer(10000);
    if (!ready) {
      throw new Error("OpenCode server not reachable. Make sure 'opencode' is installed and try again.");
    }

    const oc = await import("../api/opencode.js");
    const session = await oc.createSession(undefined, "CodeJet Session");

    const parts = [
      { type: "text" as const, content },
    ];

    const ocModel = state.modelId.replace("opencode/", "");
    const response = await oc.sendMessage(session.id, parts, { model: ocModel });

    let fullContent = "";
    for (const part of response.parts) {
      if (part.type === "text" && part.content) {
        fullContent += part.content;
      }
    }

    if (fullContent) {
      dispatch({ type: "SET_STREAMING_CONTENT", content: fullContent });
      const assistantMsg: ChatMessage = {
        id: genId(),
        role: "assistant",
        content: fullContent,
        timestamp: Date.now(),
        modelName: currentModel?.name,
      };
      dispatch({ type: "ADD_MESSAGE", message: assistantMsg });

      const estimatedTokens = state.contextTokensUsed + fullContent.length / 4 + content.length / 4;
      dispatch({
        type: "SET_CONTEXT_TOKENS",
        used: Math.round(estimatedTokens),
        max: currentModel?.maxContext ?? 131072,
      });
    } else {
      throw new Error("OpenCode returned an empty response");
    }
  }

  async function handleKiloMessage(content: string) {
    const keys = loadKeys();

    if (!keys.kilo_token) {
      const assistantMsg: ChatMessage = {
        id: genId(),
        role: "assistant",
        content: "[No Kilo API key found. Set your Kilo token in ~/.codejet/keys.json]",
        timestamp: Date.now(),
        modelName: currentModel?.name,
      };
      dispatch({ type: "ADD_MESSAGE", message: assistantMsg });
      return;
    }

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
    const toolCalls: string[] = [];
    const fileChanges: FileChange[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const delta = value.choices?.[0]?.delta;
      if (delta?.content) {
        fullContent += delta.content;
        dispatch({ type: "SET_STREAMING_CONTENT", content: fullContent });
      }
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.function?.name) {
            toolCalls.push(tc.function.name);
          }
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
              fileChanges.push({ path: args.path, added: args.content?.split("\n").length ?? 0, removed: 0 });
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
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        fileChanges: fileChanges.length > 0 ? fileChanges : undefined,
      };
      dispatch({ type: "ADD_MESSAGE", message: assistantMsg });

      const estimatedTokens = state.contextTokensUsed + fullContent.length / 4 + content.length / 4;
      dispatch({
        type: "SET_CONTEXT_TOKENS",
        used: Math.round(estimatedTokens),
        max: currentModel?.maxContext ?? 131072,
      });
    }
  }

  useEffect(() => {
    if (fileNotifications.length > 0) {
      const timer = setTimeout(() => {
        setFileNotifications((prev) => prev.slice(1));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [fileNotifications.length]);

  const rows = process.stdout.rows ?? 24;
  const chatHeight = Math.max(4, rows - 8);

  return (
    <Box flexDirection="column" width="100%" height="100%">
      {modalMode !== "none" ? (
        <>
          {modalMode === "command" && (
            <CommandModal
              visible={true}
              selectedIndex={modalIndex}
              onSelect={handleCommandAction}
              onClose={() => setModalMode("none")}
            />
          )}
          {modalMode === "model" && (
            <ModelSelector
              visible={true}
              selectedIndex={modalIndex}
              onSelect={(modelId, provider) => {
                dispatch({ type: "SET_MODEL", modelId, provider });
                const model = getModelById(modelId);
                if (model) {
                  dispatch({ type: "SET_CONTEXT_TOKENS", used: 0, max: model.maxContext });
                }
                setModalMode("none");
              }}
              onClose={() => setModalMode("none")}
            />
          )}
        </>
      ) : (
        <>
          {state.updateAvailable && state.updatePhase === "idle" && (
            <UpdateToast version={state.updateAvailable} highlighted={true} />
          )}
          {(state.updatePhase === "installing" || state.updatePhase === "done" || state.updatePhase === "error") && (
            <UpdateModal
              visible={true}
              phase={state.updatePhase === "installing" ? "Installing..." : state.updatePhase === "done" ? "Done!" : "Error during install"}
              logLines={state.updateLog}
              completed={state.updatePhase === "done"}
            />
          )}

          {/* Header - ASCII art + model + mode badge */}
          <Header model={currentModel?.name ?? state.modelId} mode={state.mode} />

          {/* Main content area */}
          <Box flexDirection="row" flexGrow={1} height={chatHeight}>
            {/* Chat column */}
            <Box flexDirection="column" flexGrow={1} overflow="hidden">
              <ChatArea
                messages={state.messages}
                streaming={state.streaming}
                streamingContent={state.streamingContent}
                modelName={currentModel?.name ?? "assistant"}
                maxHeight={chatHeight - 2}
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
                modelName={currentModel?.name ?? state.modelId}
                onSubmit={handleSendMessage}
                disabled={state.streaming || !!state.pendingQuestion}
              />
            </Box>

            {/* Todo sidebar */}
            {state.todos.length > 0 && (
              <Box paddingLeft={1}>
                <TodoPanel todos={state.todos} />
              </Box>
            )}
          </Box>

          {/* Status bar */}
          <StatusBar
            mode={state.mode}
            modelId={state.modelId}
            contextUsed={state.contextTokensUsed}
            contextMax={state.contextTokensMax}
            streaming={state.streaming}
            todoCount={state.todos.length}
          />
        </>
      )}
    </Box>
  );
}
