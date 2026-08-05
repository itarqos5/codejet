import { loadKeys } from "./keys.js";

const BASE_URL = "https://api.kilo.ai/api/gateway";

function authHeaders(): Record<string, string> {
  const keys = loadKeys();
  const token = keys.kilo_token;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function api<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: authHeaders(),
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Kilo ${method} ${path} failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

// ── Types ───────────────────────────────────────────────────

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string[];
  stream?: boolean;
  tools?: Tool[];
  tool_choice?: "auto" | "none" | "required" | { type: "function"; function: { name: string } };
}

export interface Tool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * A tool call as it arrives inside a stream: every field is optional because the
 * provider sends it in fragments. `index` identifies which call a fragment
 * belongs to, and `function.arguments` accumulates across chunks — a single
 * fragment is usually not valid JSON on its own.
 */
export interface ToolCallDelta {
  index?: number;
  id?: string;
  type?: "function";
  function?: {
    name?: string;
    arguments?: string;
  };
}

/**
 * Streamed delta. Reasoning-capable models emit chain-of-thought on a channel
 * separate from `content`; providers disagree on the field name, so both known
 * spellings are accepted.
 */
export interface ChunkDelta {
  role?: ChatMessage["role"];
  content?: string | null;
  reasoning?: string | null;
  reasoning_content?: string | null;
  tool_calls?: ToolCallDelta[];
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: ChatMessage;
    finish_reason: string | null;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    delta: ChunkDelta;
    finish_reason: string | null;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ModelInfo {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
}

export interface FIMRequest {
  model: string;
  prompt: string;
  suffix?: string;
  max_tokens?: number;
  temperature?: number;
  stop?: string[];
  stream?: boolean;
}

export interface FIMResponse {
  id: string;
  choices: {
    text: string;
    index: number;
  }[];
  model: string;
}

// ── API Methods ─────────────────────────────────────────────

export async function chatCompletions(
  body: ChatCompletionRequest,
): Promise<ChatCompletionResponse> {
  return api<ChatCompletionResponse>("POST", "/chat/completions", body);
}

export async function chatCompletionsStream(
  body: ChatCompletionRequest,
): Promise<ReadableStream<ChatCompletionChunk>> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ ...body, stream: true }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Kilo stream failed (${res.status}): ${text}`);
  }

  if (!res.body) throw new Error("No response body for stream");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") {
          controller.close();
          return;
        }
        try {
          const chunk = JSON.parse(data) as ChatCompletionChunk;
          controller.enqueue(chunk);
        } catch {
          // skip malformed chunks
        }
      }
    },
  });
}

// Models

export async function listModels(): Promise<ModelInfo[]> {
  const res = await api<{ data: ModelInfo[] }>("GET", "/models");
  return res.data;
}

// Providers

export async function listProviders(): Promise<ProviderInfo[]> {
  return api<ProviderInfo[]>("GET", "/providers");
}

// FIM

export async function fimCompletions(req: FIMRequest): Promise<FIMResponse> {
  return api<FIMResponse>("POST", "/fim/completions", req);
}

// Health check

export async function pingKiloApi(): Promise<boolean> {
  try {
    const keys = loadKeys();
    if (!keys.kilo_token) return false;
    const res = await fetch(`${BASE_URL}/models`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
