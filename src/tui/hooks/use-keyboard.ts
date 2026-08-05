import { useInput } from "ink";
import { getModelProvider } from "../models.js";
import { buildModelItems, COMMANDS } from "../components/modal.js";
import { logSessionErrors, type SessionError } from "../../api/logger.js";
import type { AppState } from "../state.js";

export type PaletteMode = "none" | "command" | "model";

interface KeyboardDeps {
  state: AppState;
  dispatch: React.Dispatch<any>;
  palette: PaletteMode;
  setPalette: (mode: PaletteMode | ((prev: PaletteMode) => PaletteMode)) => void;
  paletteIndex: number;
  setPaletteIndex: (index: number | ((prev: number) => number)) => void;
  questionIndex: number;
  setQuestionIndex: (index: number | ((prev: number) => number)) => void;
  sessionErrors: React.MutableRefObject<SessionError[]>;
  exit: () => void;
  handleCommandAction: (action: string) => void;
  abortStream: () => void;
}

/**
 * Global key handling.
 *
 * Precedence is explicit and every branch returns, so a key is consumed in
 * exactly one place. The prompt owns text editing and is disabled whenever an
 * overlay is up, which is why arrow keys can be reused here without clashing.
 */
export function useKeyboard({
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
}: KeyboardDeps) {
  useInput((input, key) => {
    // ── Quit ────────────────────────────────────────────────
    if (key.ctrl && input === "c") {
      logSessionErrors(sessionErrors.current);
      import("../../api/opencode-server.js")
        .then((mod) => mod.stopServer())
        .catch(() => {});
      // Deliberately no screen clear: wiping the terminal on exit also wipes
      // the transcript the user may still want to read or copy.
      exit();
      return;
    }

    // ── Update prompts ──────────────────────────────────────
    if (state.updatePhase === "done") {
      if (key.return) {
        import("../../api/updater.js").then((mod) => mod.restartApp());
      }
      return;
    }

    if (state.updatePhase === "error") {
      if (key.escape || key.return) {
        dispatch({ type: "SET_UPDATE_PHASE", phase: "idle" });
        dispatch({ type: "SET_UPDATE_AVAILABLE", version: null });
      }
      return;
    }

    if (state.updatePhase === "installing") return;

    if (state.updateAvailable && state.updatePhase === "idle") {
      if (key.return) {
        dispatch({ type: "SET_UPDATE_PHASE", phase: "installing" });
        import("../../api/updater.js").then((mod) => {
          mod
            .installUpdate(state.updateAvailable ?? undefined, ({ task, percent }) => {
              dispatch({ type: "SET_UPDATE_PROGRESS", task, percent });
            })
            .then((ok) => {
              dispatch({ type: "SET_UPDATE_PHASE", phase: ok ? "done" : "error" });
              if (!ok) {
                dispatch({
                  type: "SET_UPDATE_ERROR",
                  error: "Update failed. See the log in ~/.codejet/logs for details.",
                });
              }
            });
        });
        return;
      }
      if (key.escape) {
        dispatch({ type: "SET_UPDATE_AVAILABLE", version: null });
        return;
      }
      // Any other key falls through so the toast does not block typing.
    }

    // ── Plan confirmation ───────────────────────────────────
    if (state.pendingPlan) {
      if (key.return) {
        state.pendingPlan.resolve(true);
        dispatch({ type: "SET_PENDING_PLAN", plan: null });
      } else if (key.escape) {
        state.pendingPlan.resolve(false);
        dispatch({ type: "SET_PENDING_PLAN", plan: null });
      }
      return;
    }

    // ── Question with fixed options ─────────────────────────
    if (state.pendingQuestion) {
      const options = state.pendingQuestion.options ?? [];
      if (options.length === 0) return; // free text: the prompt handles it

      if (key.upArrow) {
        setQuestionIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setQuestionIndex((prev) => Math.min(options.length - 1, prev + 1));
      } else if (key.return) {
        const answer = options[Math.min(questionIndex, options.length - 1)];
        state.pendingQuestion.resolve(answer);
        dispatch({ type: "SET_PENDING_QUESTION", question: null });
        setQuestionIndex(0);
      } else if (/^[1-9]$/.test(input)) {
        const idx = Number(input) - 1;
        if (idx < options.length) {
          state.pendingQuestion.resolve(options[idx]);
          dispatch({ type: "SET_PENDING_QUESTION", question: null });
          setQuestionIndex(0);
        }
      }
      return;
    }

    // ── Command palette ─────────────────────────────────────
    if (key.ctrl && input === "p") {
      setPalette((prev) => (prev === "none" ? "command" : "none"));
      setPaletteIndex(0);
      return;
    }

    if (palette === "command") {
      if (key.escape) {
        setPalette("none");
      } else if (key.upArrow) {
        setPaletteIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setPaletteIndex((prev) => Math.min(COMMANDS.length - 1, prev + 1));
      } else if (key.return) {
        const action = COMMANDS[Math.min(paletteIndex, COMMANDS.length - 1)].action;
        // "model" swaps to the model palette, so it must stay open.
        if (action !== "model") setPalette("none");
        handleCommandAction(action);
      }
      return;
    }

    if (palette === "model") {
      const selectable = buildModelItems().filter((i) => i.type === "model");
      if (key.escape) {
        setPalette("none");
      } else if (key.upArrow) {
        setPaletteIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setPaletteIndex((prev) => Math.min(selectable.length - 1, prev + 1));
      } else if (key.return) {
        const chosen = selectable[Math.min(paletteIndex, selectable.length - 1)]?.model;
        if (chosen) {
          dispatch({
            type: "SET_MODEL",
            modelId: chosen.id,
            provider: getModelProvider(chosen.id),
          });
          dispatch({ type: "SET_CONTEXT_TOKENS", used: 0, max: chosen.maxContext });
        }
        setPalette("none");
      }
      return;
    }

    // ── Interrupt a running turn (two-step) ─────────────────
    if (key.escape) {
      if (state.streaming) {
        if (state.cancelPending) {
          abortStream();
          dispatch({ type: "SET_CANCEL_PENDING", pending: false });
        } else {
          dispatch({ type: "SET_CANCEL_PENDING", pending: true });
        }
      }
      return;
    }

    // Any other key clears a half-armed cancel.
    if (state.cancelPending) {
      dispatch({ type: "SET_CANCEL_PENDING", pending: false });
    }

    // ── Mode toggle ─────────────────────────────────────────
    if (key.tab) {
      dispatch({ type: "SET_MODE", mode: state.mode === "build" ? "plan" : "build" });
      return;
    }
  });
}
