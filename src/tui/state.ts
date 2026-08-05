import type { Todo } from "../tools/todo.js";
import type { ModelProvider } from "./models.js";

export type AppMode = "build" | "plan";

export interface FileChange {
  path: string;
  added: number;
  removed: number;
}

export type MessageRole =
  | "user"
  | "assistant"
  | "system"
  | "thinking"
  | "tool"
  | "file-change";

export type ToolStatus = "running" | "done" | "error";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  modelName?: string;

  /** Reasoning captured for this turn (think() tool or a reasoning stream). */
  thinking?: string;

  /** Tool activity */
  toolName?: string;
  toolStatus?: ToolStatus;
  toolDetail?: string;

  /** File activity */
  filePath?: string;
  fileAction?: "created" | "modified" | "deleted";

  toolCalls?: string[];
  fileChanges?: FileChange[];
}

export interface PendingQuestion {
  id: string;
  question: string;
  options?: string[];
  resolve: (answer: string) => void;
  selectedIndex?: number;
}

export interface PendingPlan {
  id: string;
  content: string;
  resolve: (proceed: boolean) => void;
}

export type UpdatePhase = "idle" | "checking" | "installing" | "done" | "error";

export interface AppState {
  messages: ChatMessage[];
  mode: AppMode;
  modelId: string;
  provider: ModelProvider;
  opencodeReady: boolean;

  /** A request is in flight. */
  streaming: boolean;
  streamingContent: string;

  /**
   * The model is reasoning rather than producing visible output. Drives the
   * "Thinking" indicator.
   */
  thinking: boolean;
  /** Timestamp the current thinking phase started, for elapsed display. */
  thinkingSince: number | null;
  /** Accumulated reasoning text for the current turn. */
  thinkingText: string;
  /** Short label for the current activity, e.g. "Thinking", "Connecting". */
  activityLabel: string;

  cancelPending: boolean;
  todos: Todo[];
  pendingQuestion: PendingQuestion | null;
  pendingPlan: PendingPlan | null;
  contextTokensUsed: number;
  contextTokensMax: number;
  error: string | null;
  updateAvailable: string | null;
  updatePhase: UpdatePhase;
  updateTask: string;
  updateProgress: number;
  updateError: string | null;
}

export type AppAction =
  | { type: "ADD_MESSAGE"; message: ChatMessage }
  | { type: "UPDATE_MESSAGE"; id: string; patch: Partial<ChatMessage> }
  | { type: "SET_MODE"; mode: AppMode }
  | { type: "SET_MODEL"; modelId: string; provider: ModelProvider }
  | { type: "SET_OPENCODE_READY"; ready: boolean }
  | { type: "SET_STREAMING"; streaming: boolean }
  | { type: "SET_STREAMING_CONTENT"; content: string }
  | { type: "SET_THINKING"; thinking: boolean; label?: string }
  | { type: "SET_THINKING_TEXT"; text: string }
  | { type: "APPEND_THINKING_TEXT"; text: string }
  | { type: "SET_ACTIVITY_LABEL"; label: string }
  | { type: "SET_CANCEL_PENDING"; pending: boolean }
  | { type: "SET_TODOS"; todos: Todo[] }
  | { type: "SET_PENDING_QUESTION"; question: PendingQuestion | null }
  | { type: "SET_PENDING_PLAN"; plan: PendingPlan | null }
  | { type: "SET_CONTEXT_TOKENS"; used: number; max: number }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SET_UPDATE_AVAILABLE"; version: string | null }
  | { type: "SET_UPDATE_PHASE"; phase: UpdatePhase }
  | { type: "SET_UPDATE_PROGRESS"; task: string; percent: number }
  | { type: "SET_UPDATE_ERROR"; error: string }
  | { type: "CLEAR_MESSAGES" };

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.message] };

    case "UPDATE_MESSAGE":
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.id ? { ...m, ...action.patch } : m,
        ),
      };

    case "SET_MODE":
      return { ...state, mode: action.mode };

    case "SET_MODEL":
      return { ...state, modelId: action.modelId, provider: action.provider };

    case "SET_OPENCODE_READY":
      return { ...state, opencodeReady: action.ready };

    case "SET_STREAMING":
      // Starting a turn resets the per-turn reasoning buffer; ending one clears
      // every transient indicator so the frame cannot be left mid-animation.
      return action.streaming
        ? {
            ...state,
            streaming: true,
            cancelPending: false,
            thinking: true,
            thinkingSince: Date.now(),
            thinkingText: "",
            activityLabel: "Thinking",
          }
        : {
            ...state,
            streaming: false,
            cancelPending: false,
            thinking: false,
            thinkingSince: null,
            streamingContent: "",
            activityLabel: "",
          };

    case "SET_STREAMING_CONTENT":
      // Visible output means the model is no longer purely thinking.
      return {
        ...state,
        streamingContent: action.content,
        thinking: action.content.length > 0 ? false : state.thinking,
      };

    case "SET_THINKING":
      return {
        ...state,
        thinking: action.thinking,
        thinkingSince: action.thinking ? (state.thinkingSince ?? Date.now()) : null,
        activityLabel: action.label ?? (action.thinking ? "Thinking" : ""),
      };

    case "SET_THINKING_TEXT":
      return { ...state, thinkingText: action.text };

    case "APPEND_THINKING_TEXT":
      return { ...state, thinkingText: state.thinkingText + action.text };

    case "SET_ACTIVITY_LABEL":
      return { ...state, activityLabel: action.label };

    case "SET_CANCEL_PENDING":
      return { ...state, cancelPending: action.pending };

    case "SET_TODOS":
      return { ...state, todos: action.todos };

    case "SET_PENDING_QUESTION":
      return { ...state, pendingQuestion: action.question };

    case "SET_PENDING_PLAN":
      return { ...state, pendingPlan: action.plan };

    case "SET_CONTEXT_TOKENS":
      return { ...state, contextTokensUsed: action.used, contextTokensMax: action.max };

    case "SET_ERROR":
      return { ...state, error: action.error };

    case "SET_UPDATE_AVAILABLE":
      return { ...state, updateAvailable: action.version };

    case "SET_UPDATE_PHASE":
      return { ...state, updatePhase: action.phase };

    case "SET_UPDATE_PROGRESS":
      return { ...state, updateTask: action.task, updateProgress: action.percent };

    case "SET_UPDATE_ERROR":
      return { ...state, updatePhase: "error", updateError: action.error };

    case "CLEAR_MESSAGES":
      return {
        ...state,
        messages: [],
        streamingContent: "",
        thinkingText: "",
        contextTokensUsed: 0,
        error: null,
      };

    default:
      return state;
  }
}

export const INITIAL_STATE: AppState = {
  messages: [],
  mode: "build",
  modelId: "opencode/deepseek-v4-flash-free",
  provider: "opencode",
  opencodeReady: false,
  streaming: false,
  streamingContent: "",
  thinking: false,
  thinkingSince: null,
  thinkingText: "",
  activityLabel: "",
  cancelPending: false,
  todos: [],
  pendingQuestion: null,
  pendingPlan: null,
  contextTokensUsed: 0,
  contextTokensMax: 131072,
  error: null,
  updateAvailable: null,
  updatePhase: "idle",
  updateTask: "",
  updateProgress: 0,
  updateError: null,
};
