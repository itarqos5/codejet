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
  content: string;
  name?: string;
  tool_call_id?: string;
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
    delta: Partial<ChatMessage>;
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

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }

      const text = decoder.decode(value, { stream: true });
      const lines = text.split("\n").filter((l) => l.startsWith("data: "));

      for (const line of lines) {
        const data = line.slice(6);
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
