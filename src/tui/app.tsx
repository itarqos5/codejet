import React, { useReducer, useCallback, useEffect, useState, useRef } from "react";
import { Box, Text, useApp } from "ink";
import { Header } from "./components/header.js";
import { ChatArea } from "./components/chat.js";
import { InputBox } from "./components/input.js";
import { StatusBar } from "./components/statusbar.js";
import { CommandModal, ModelSelector } from "./components/modal.js";
import { TodoPanel } from "./components/todo.js";
import { QuestionPrompt } from "./components/question.js";
import { PlanPrompt } from "./components/plan-prompt.js";
import { FileNotification } from "./components/file-notification.js";
import { UpdateToast } from "./components/update-toast.js";
import { UpdateModal } from "./components/update-modal.js";
import { appReducer, INITIAL_STATE, type ChatMessage } from "./state.js";
import { getModelById } from "./models.js";
import { useKeyboard } from "./hooks/use-keyboard.js";
import { useMessageHandler } from "./hooks/use-message-handler.js";
import type { SessionError } from "../api/logger.js";

export default function App() {
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE);
  const { exit } = useApp();
  const [modalMode, setModalMode] = useState<"none" | "command" | "model">("none");
  const [modalIndex, setModalIndex] = useState(0);
  const [fileNotifications, setFileNotifications] = useState<
    { filePath: string; action: "created" | "modified" | "deleted" }[]
  >([]);
  const [, setResizeTick] = useState(0);

  const currentModel = getModelById(state.modelId);
  const sessionErrors = useRef<SessionError[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Force re-render on terminal resize
  useEffect(() => {
    const onResize = () => setResizeTick((t) => t + 1);
    process.stdout.on("resize", onResize);
    return () => { process.stdout.off("resize", onResize); };
  }, []);

  // Startup: OpenCode server + Kilo ping + update check
  useEffect(() => {
    // 1. Start OpenCode server
    import("../api/opencode-server.js").then(async (mod) => {
      const ok = await mod.startServer();
      dispatch({ type: "SET_OPENCODE_READY", ready: ok });
    }).catch(() => {
      dispatch({ type: "SET_OPENCODE_READY", ready: false });
    });

    // 2. Check for updates
    import("../api/updater.js").then((mod) => {
      mod.checkForUpdate().then((info) => {
        if (info) {
          dispatch({ type: "SET_UPDATE_AVAILABLE", version: info.version });
        }
      });
    }).catch(() => {});
  }, []);

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
        case "check-update":
          import("../api/updater.js").then((mod) => {
            mod.checkForUpdate().then((info) => {
              if (info) {
                dispatch({ type: "SET_UPDATE_AVAILABLE", version: info.version });
              } else {
                dispatch({ type: "SET_ERROR", error: "No updates available. You're on the latest version." });
                setTimeout(() => dispatch({ type: "SET_ERROR", error: null }), 3000);
              }
            });
          });
          break;
      }
    },
    [],
  );

  const { handleSendMessage, abortStream } = useMessageHandler({
    state,
    dispatch,
    sessionErrors,
    setFileNotifications,
    abortControllerRef,
  });

  useKeyboard({
    state,
    dispatch,
    modalMode,
    setModalMode,
    modalIndex,
    setModalIndex,
    sessionErrors,
    exit,
    handleCommandAction,
    abortStream,
  });

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

          <Header model={currentModel?.name ?? state.modelId} mode={state.mode} />

          <Box flexDirection="row" flexGrow={1} height={chatHeight}>
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

              {state.pendingPlan && (
                <PlanPrompt
                  onProceed={() => {
                    state.pendingPlan?.resolve(true);
                    dispatch({ type: "SET_PENDING_PLAN", plan: null });
                  }}
                  onDismiss={() => {
                    state.pendingPlan?.resolve(false);
                    dispatch({ type: "SET_PENDING_PLAN", plan: null });
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
                disabled={state.streaming || !!state.pendingQuestion || !!state.pendingPlan}
                messageCount={state.messages.length}
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
        </>
      )}
    </Box>
  );
}
