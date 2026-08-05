import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Box, Static, Text, useApp } from "ink";

import { Banner } from "./components/header.js";
import { MessageView, LiveMessage, EmptyState } from "./components/chat.js";
import { PromptInput } from "./components/input.js";
import { StatusBar } from "./components/statusbar.js";
import { CommandPalette, ModelPalette } from "./components/modal.js";
import { TodoPanel } from "./components/todo.js";
import { QuestionPrompt } from "./components/question.js";
import { PlanPrompt } from "./components/plan-prompt.js";
import { FileNotification } from "./components/file-notification.js";
import { UpdateToast } from "./components/update-toast.js";
import { UpdatePanel } from "./components/update-modal.js";
import { ThinkingIndicator } from "./components/thinking.js";

import { appReducer, INITIAL_STATE, type ChatMessage } from "./state.js";
import { getModelById } from "./models.js";
import { COLOR } from "./theme.js";
import { useKeyboard, type PaletteMode } from "./hooks/use-keyboard.js";
import { useMessageHandler } from "./hooks/use-message-handler.js";
import { useTerminalSize } from "./hooks/use-terminal-size.js";
import { loadTodos } from "../tools/todo.js";
import type { SessionError } from "../api/logger.js";

/**
 * Root layout.
 *
 * The screen is split in two:
 *
 *  - A static transcript (`<Static>`), written to the terminal once per entry
 *    and never redrawn. This gives native scrollback and mouse-wheel scrolling
 *    for free, and makes it impossible for history to be corrupted by a later
 *    frame. It replaces the old hand-rolled slice-based scroller, which sliced
 *    by message count while measuring in rows and so never lined up.
 *
 *  - A live frame containing only what changes: the in-flight response, the
 *    thinking indicator, any open panel, the prompt and the status bar. This is
 *    kept strictly shorter than the terminal, because an ink frame taller than
 *    the viewport cannot be diffed correctly and tears.
 */

type StaticEntry =
  | { key: string; kind: "banner" }
  | { key: string; kind: "message"; message: ChatMessage };

export default function App() {
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE);
  const { exit } = useApp();
  const size = useTerminalSize();

  const [palette, setPalette] = useState<PaletteMode>("none");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [fileNotifications, setFileNotifications] = useState<
    { filePath: string; action: "created" | "modified" | "deleted" }[]
  >([]);

  /**
   * Remount key for <Static>. Ink only emits items appended past the highest
   * index it has already written, so clearing the transcript would otherwise
   * swallow the next few messages. Bumping this remounts the static region.
   */
  const [transcriptGeneration, setTranscriptGeneration] = useState(0);

  const currentModel = getModelById(state.modelId);
  const modelName = currentModel?.name ?? state.modelId;
  const sessionErrors = useRef<SessionError[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const width = size.width;

  // ── Startup ─────────────────────────────────────────────────
  useEffect(() => {
    import("../api/opencode-server.js")
      .then(async (mod) => {
        const ok = await mod.startServer();
        dispatch({ type: "SET_OPENCODE_READY", ready: ok });
      })
      .catch(() => dispatch({ type: "SET_OPENCODE_READY", ready: false }));

    import("../api/updater.js")
      .then((mod) =>
        mod.checkForUpdate().then((info) => {
          if (info) dispatch({ type: "SET_UPDATE_AVAILABLE", version: info.version });
        }),
      )
      .catch(() => {});

    loadTodos()
      .then((todos) => dispatch({ type: "SET_TODOS", todos }))
      .catch(() => {});
  }, []);

  // Transient notices expire on their own.
  useEffect(() => {
    if (fileNotifications.length === 0) return;
    const timer = setTimeout(() => setFileNotifications([]), 4000);
    return () => clearTimeout(timer);
  }, [fileNotifications.length]);

  useEffect(() => {
    if (!state.error) return;
    const timer = setTimeout(() => dispatch({ type: "SET_ERROR", error: null }), 6000);
    return () => clearTimeout(timer);
  }, [state.error]);

  useEffect(() => {
    setQuestionIndex(0);
  }, [state.pendingQuestion?.id]);

  const { handleSendMessage, abortStream } = useMessageHandler({
    state,
    dispatch,
    sessionErrors,
    setFileNotifications,
    abortControllerRef,
  });

  const handleCommandAction = useCallback(
    (action: string) => {
      switch (action) {
        case "new":
          dispatch({ type: "CLEAR_MESSAGES" });
          setTranscriptGeneration((g) => g + 1);
          break;

        case "model":
          setPalette("model");
          setPaletteIndex(0);
          break;

        case "todos":
          loadTodos()
            .then((todos) => dispatch({ type: "SET_TODOS", todos }))
            .catch(() => {});
          break;

        case "check-update":
          import("../api/updater.js").then((mod) =>
            mod.checkForUpdate().then((info) => {
              if (info) {
                dispatch({ type: "SET_UPDATE_AVAILABLE", version: info.version });
              } else {
                dispatch({ type: "SET_ERROR", error: "Already on the latest version." });
              }
            }),
          );
          break;

        case "quit":
          exit();
          break;
      }
    },
    [exit],
  );

  useKeyboard({
    state,
    dispatch,
    palette,
    setPalette,
    paletteIndex,
    setPaletteIndex,
    questionIndex,
    setQuestionIndex,
    sessionErrors,
    exit,
    handleCommandAction,
    abortStream,
  });

  // ── Static transcript ───────────────────────────────────────
  const staticEntries = useMemo<StaticEntry[]>(
    () => [
      { key: "banner", kind: "banner" },
      ...state.messages.map<StaticEntry>((message) => ({
        key: message.id,
        kind: "message",
        message,
      })),
    ],
    [state.messages],
  );

  // ── Live region sizing ──────────────────────────────────────
  const freeTextQuestion = !!state.pendingQuestion && !state.pendingQuestion.options?.length;
  const paletteOpen = palette !== "none";
  const updateBusy =
    state.updatePhase === "installing" ||
    state.updatePhase === "done" ||
    state.updatePhase === "error";
  const showUpdateToast = !!state.updateAvailable && state.updatePhase === "idle";

  const paletteRows = paletteOpen ? Math.max(4, Math.min(12, size.height - 10)) : 0;
  const questionRows = state.pendingQuestion
    ? 4 + (state.pendingQuestion.options?.length ?? 0)
    : 0;
  const todoRows = state.todos.length > 0 ? Math.min(state.todos.length, 6) + 3 : 0;

  const reservedRows =
    3 + // prompt box
    1 + // status bar
    (state.thinking ? 2 : 0) +
    (state.error ? 1 : 0) +
    fileNotifications.length +
    paletteRows +
    questionRows +
    (state.pendingPlan ? 4 : 0) +
    (showUpdateToast ? 4 : 0) +
    (updateBusy ? 6 : 0) +
    todoRows;

  const maxLiveLines = Math.max(0, size.height - reservedRows - 1);

  // The prompt keeps focus unless an overlay owns the keyboard. A pending
  // free-text question is the one case where the prompt stays active but its
  // submission is routed elsewhere.
  const promptDisabled =
    paletteOpen ||
    !!state.pendingPlan ||
    (!!state.pendingQuestion && !freeTextQuestion) ||
    updateBusy;

  const onSubmit = useCallback(
    (value: string) => {
      if (state.pendingQuestion && !state.pendingQuestion.options?.length) {
        state.pendingQuestion.resolve(value);
        dispatch({ type: "SET_PENDING_QUESTION", question: null });
        return;
      }
      handleSendMessage(value);
    },
    [state.pendingQuestion, handleSendMessage],
  );

  return (
    <Box flexDirection="column" width={width}>
      <Static key={transcriptGeneration} items={staticEntries}>
        {(entry) =>
          entry.kind === "banner" ? (
            <Banner key={entry.key} width={width} cwd={process.cwd()} model={modelName} />
          ) : (
            <Box key={entry.key} flexDirection="column" width={width} marginBottom={1}>
              <MessageView message={entry.message} width={width} />
            </Box>
          )
        }
      </Static>

      <Box flexDirection="column" width={width}>
        {state.messages.length === 0 && !state.streaming && <EmptyState width={width} />}

        {state.streaming && maxLiveLines > 0 && (
          <LiveMessage
            content={state.streamingContent}
            modelName={modelName}
            width={width}
            maxLines={maxLiveLines}
          />
        )}

        {state.thinking && (
          <ThinkingIndicator
            label={state.activityLabel || "Thinking"}
            detail={state.thinkingText}
            since={state.thinkingSince ?? Date.now()}
            width={width}
            maxDetailLines={maxLiveLines > 6 ? 2 : 0}
          />
        )}

        {fileNotifications.map((n, i) => (
          <FileNotification key={`${n.filePath}-${i}`} filePath={n.filePath} action={n.action} width={width} />
        ))}

        {state.error && (
          <Box width={width}>
            <Text color={COLOR.error} wrap="truncate-end">
              {state.error}
            </Text>
          </Box>
        )}

        {state.todos.length > 0 && !paletteOpen && <TodoPanel todos={state.todos} width={width} />}

        {updateBusy && (
          <UpdatePanel
            phase={state.updatePhase}
            currentTask={state.updateTask}
            progress={state.updateProgress}
            error={state.updateError}
            width={width}
          />
        )}

        {showUpdateToast && <UpdateToast version={state.updateAvailable!} width={width} />}

        {state.pendingQuestion && (
          <QuestionPrompt
            question={state.pendingQuestion}
            selectedIndex={questionIndex}
            width={width}
          />
        )}

        {state.pendingPlan && <PlanPrompt width={width} />}

        {palette === "command" && (
          <CommandPalette selectedIndex={paletteIndex} width={width} maxRows={paletteRows - 3} />
        )}

        {palette === "model" && (
          <ModelPalette
            selectedIndex={paletteIndex}
            currentModelId={state.modelId}
            width={width}
            maxRows={paletteRows - 3}
          />
        )}

        <PromptInput
          mode={state.mode}
          disabled={promptDisabled}
          busy={state.streaming && !freeTextQuestion}
          width={width}
          onSubmit={onSubmit}
        />

        <StatusBar
          mode={state.mode}
          modelName={modelName}
          contextUsed={state.contextTokensUsed}
          contextMax={state.contextTokensMax}
          busy={state.streaming}
          cancelPending={state.cancelPending}
          todoCount={state.todos.length}
          width={width}
        />
      </Box>
    </Box>
  );
}
