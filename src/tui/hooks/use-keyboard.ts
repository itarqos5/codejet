import { useState, useCallback } from "react";
import { useInput } from "ink";
import { getModelById, getModelProvider } from "../models.js";
import type { AppState } from "../state.js";
import { buildModelItems } from "../components/modal.js";
import { logSessionErrors, type SessionError } from "../../api/logger.js";

type ModalMode = "none" | "command" | "model";

interface KeyboardDeps {
  state: AppState;
  dispatch: React.Dispatch<any>;
  modalMode: ModalMode;
  setModalMode: (mode: ModalMode | ((prev: ModalMode) => ModalMode)) => void;
  modalIndex: number;
  setModalIndex: (index: number | ((prev: number) => number)) => void;
  sessionErrors: React.MutableRefObject<SessionError[]>;
  exit: () => void;
  handleCommandAction: (action: string) => void;
  abortStream: () => void;
}

export function useKeyboard({
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
}: KeyboardDeps) {
  useInput((input, key) => {
    // Ctrl+C - log errors, clear terminal, exit
    if (key.ctrl && input === "c") {
      logSessionErrors(sessionErrors.current);
      import("../../api/opencode-server.js").then((mod) => mod.stopServer()).catch(() => {});
      process.stdout.write("\x1B[2J\x1B[0f");
      exit();
      return;
    }

    // Plan prompt - Enter to proceed, Esc to dismiss
    if (state.pendingPlan) {
      if (key.return) {
        state.pendingPlan.resolve(true);
        dispatch({ type: "SET_PENDING_PLAN", plan: null });
        return;
      }
      if (key.escape) {
        state.pendingPlan.resolve(false);
        dispatch({ type: "SET_PENDING_PLAN", plan: null });
        return;
      }
      return;
    }

    // Update flow - Enter to install, Esc to dismiss
    if (state.updateAvailable && state.updatePhase === "idle") {
      if (key.return) {
        dispatch({ type: "SET_UPDATE_PHASE", phase: "installing" });
        import("../../api/updater.js").then((mod) => {
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
        import("../../api/updater.js").then((mod) => mod.restartApp());
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

    // Escape - close modals or abort streaming
    if (key.escape) {
      if (modalMode !== "none") {
        setModalMode("none");
        return;
      }
      if (state.streaming) {
        abortStream();
        dispatch({ type: "SET_STREAMING_CONTENT", content: "" });
        return;
      }
      return;
    }

    // Tab - toggle mode
    if (key.tab && modalMode === "none" && !state.pendingQuestion) {
      dispatch({
        type: "SET_MODE",
        mode: state.mode === "build" ? "plan" : "build",
      });
      return;
    }

    // Command modal navigation
    if (modalMode === "command") {
      if (key.upArrow) {
        setModalIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setModalIndex((prev) => Math.min(5, prev + 1));
      } else if (key.return) {
        const action = ["new", "model", "compact", "todos", "clear", "check-update"][modalIndex];
        handleCommandAction(action);
        if (action !== "model") {
          setModalMode("none");
        }
      }
      return;
    }

    // Model selector navigation
    if (modalMode === "model") {
      const items = buildModelItems();
      const selectableIndices = items.map((_it, i) => i).filter((i) => items[i].type === "model");
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
}
