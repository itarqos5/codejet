import type { Todo } from "../tools/todo.js";
import type { ModelProvider } from "./models.js";

export type AppMode = "build" | "plan";

export interface FileChange {
  path: string;
  added: number;
  removed: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool-call" | "tool-result" | "file-change";
  content: string;
  timestamp: number;
  modelName?: string;
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
}

export type UpdatePhase = "idle" | "checking" | "installing" | "done" | "error";

export interface AppState {
  messages: ChatMessage[];
  mode: AppMode;
  modelId: string;
  provider: ModelProvider;
  opencodeReady: boolean;
  streaming: boolean;
  streamingContent: string;
  todos: Todo[];
  pendingQuestion: PendingQuestion | null;
  showModal: boolean;
  modalIndex: number;
  inputFocused: boolean;
  contextTokensUsed: number;
  contextTokensMax: number;
  error: string | null;
  updateAvailable: string | null;
  updatePhase: UpdatePhase;
  updateLog: string[];
}

export type AppAction =
  | { type: "ADD_MESSAGE"; message: ChatMessage }
  | { type: "SET_MODE"; mode: AppMode }
  | { type: "SET_MODEL"; modelId: string; provider: ModelProvider }
  | { type: "SET_OPENCODE_READY"; ready: boolean }
  | { type: "SET_STREAMING"; streaming: boolean }
  | { type: "SET_STREAMING_CONTENT"; content: string }
  | { type: "SET_TODOS"; todos: Todo[] }
  | { type: "SET_PENDING_QUESTION"; question: PendingQuestion | null }
  | { type: "TOGGLE_MODAL" }
  | { type: "SET_MODAL_INDEX"; index: number }
  | { type: "SET_INPUT_FOCUSED"; focused: boolean }
  | { type: "SET_CONTEXT_TOKENS"; used: number; max: number }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SET_UPDATE_AVAILABLE"; version: string | null }
  | { type: "SET_UPDATE_PHASE"; phase: UpdatePhase; log?: string }
  | { type: "CLEAR_MESSAGES" };

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.message] };
    case "SET_MODE":
      return { ...state, mode: action.mode };
    case "SET_MODEL":
      return { ...state, modelId: action.modelId, provider: action.provider };
    case "SET_OPENCODE_READY":
      return { ...state, opencodeReady: action.ready };
    case "SET_STREAMING":
      return { ...state, streaming: action.streaming };
    case "SET_STREAMING_CONTENT":
      return { ...state, streamingContent: action.content };
    case "SET_TODOS":
      return { ...state, todos: action.todos };
    case "SET_PENDING_QUESTION":
      return { ...state, pendingQuestion: action.question };
    case "TOGGLE_MODAL":
      return { ...state, showModal: !state.showModal, modalIndex: 0 };
    case "SET_MODAL_INDEX":
      return { ...state, modalIndex: action.index };
    case "SET_INPUT_FOCUSED":
      return { ...state, inputFocused: action.focused };
    case "SET_CONTEXT_TOKENS":
      return { ...state, contextTokensUsed: action.used, contextTokensMax: action.max };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SET_UPDATE_AVAILABLE":
      return { ...state, updateAvailable: action.version };
    case "SET_UPDATE_PHASE":
      return {
        ...state,
        updatePhase: action.phase,
        updateLog: action.log ? [...state.updateLog, action.log] : state.updateLog,
      };
    case "CLEAR_MESSAGES":
      return { ...state, messages: [], streamingContent: "", contextTokensUsed: 0 };
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
  todos: [],
  pendingQuestion: null,
  showModal: false,
  modalIndex: 0,
  inputFocused: true,
  contextTokensUsed: 0,
  contextTokensMax: 131072,
  error: null,
  updateAvailable: null,
  updatePhase: "idle",
  updateLog: [],
};
