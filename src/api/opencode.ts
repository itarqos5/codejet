import { loadKeys } from "./keys.js";

const DEFAULT_BASE = "http://127.0.0.1:4096";

function baseUrl(): string {
  return process.env.OPENCODE_SERVER_URL ?? DEFAULT_BASE;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenCode ${method} ${path} failed (${res.status}): ${text}`);
  }

  if (res.status === 204) return undefined as T;

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    throw new Error(`OpenCode ${method} ${path} returned non-JSON (${ct})`);
  }

  const json = (await res.json()) as { data?: T };
  return (json.data !== undefined ? json.data : json) as T;
}

// ── Types ───────────────────────────────────────────────────

export interface HealthResponse {
  healthy: boolean;
  version: string;
}

export interface Session {
  id: string;
  title: string;
  directory?: string;
  parentID?: string;
  time?: { created: number; updated: number };
  projectID?: string;
  cost?: number;
  tokens?: Record<string, number>;
}

export interface MessagePart {
  type: string;
  content?: string;
  text?: string;
  [key: string]: unknown;
}

export interface Message {
  id: string;
  type?: string;
  text?: string;
  role?: string;
  sessionID?: string;
  time?: { created: number; completed?: number };
  parts?: MessagePart[];
}

export interface PromptResponse {
  admittedSeq: number;
  id: string;
  sessionID: string;
  prompt: { text: string };
  delivery: string;
  timeCreated: number;
}

export interface ModelInfo {
  id: string;
  modelID?: string;
  providerID: string;
  name: string;
  capabilities?: {
    tools: boolean;
    input: string[];
    output: string[];
  };
  enabled: boolean;
  limit?: { context: number; output: number };
}

export interface ProviderInfo {
  id: string;
  name: string;
}

export interface ProviderAuthMethod {
  type: string;
  [key: string]: unknown;
}

// ── API Methods ─────────────────────────────────────────────

export async function health(): Promise<HealthResponse> {
  return request<HealthResponse>("GET", "/global/health");
}

// Sessions

export async function listSessions(): Promise<Session[]> {
  const data = await request<Session[]>("GET", "/api/session");
  return Array.isArray(data) ? data : [];
}

export async function createSession(parentID?: string, title?: string): Promise<Session> {
  return request<Session>("POST", "/api/session", { parentID, title });
}

export async function getSession(id: string): Promise<Session> {
  return request<Session>("GET", `/api/session/${id}`);
}

export async function deleteSession(id: string): Promise<boolean> {
  return request<boolean>("DELETE", `/api/session/${id}`);
}

export async function updateSession(id: string, title: string): Promise<Session> {
  return request<Session>("PATCH", `/api/session/${id}`, { title });
}

// Messages

export async function listMessages(sessionID: string, limit?: number): Promise<Message[]> {
  const query = limit != null ? `?limit=${limit}` : "";
  return request<Message[]>("GET", `/api/session/${sessionID}/message${query}`);
}

export async function sendMessage(
  sessionID: string,
  parts: MessagePart[],
  opts?: { model?: string; agent?: string },
): Promise<PromptResponse> {
  const text = parts.map((p) => p.content ?? p.text ?? "").join("\n");
  const body: Record<string, unknown> = {
    prompt: { text },
  };
  if (opts?.model) {
    body.model = { providerID: "opencode", modelID: opts.model };
  }
  return request<PromptResponse>("POST", `/api/session/${sessionID}/prompt`, body);
}

// Models

export async function listModels(): Promise<ModelInfo[]> {
  return request<ModelInfo[]>("GET", "/api/model");
}

export async function getDefaultModel(): Promise<ModelInfo> {
  return request<ModelInfo>("GET", "/api/model/default");
}

// Providers

export async function listProviders(): Promise<ProviderInfo[]> {
  return request<ProviderInfo[]>("GET", "/api/provider");
}

export async function getProviderAuth(
  providerID: string,
): Promise<ProviderAuthMethod[]> {
  return request<ProviderAuthMethod[]>("GET", `/api/provider/${providerID}/auth`);
}

// Auth

export async function setAuth(
  providerID: string,
  credentials: Record<string, unknown>,
): Promise<boolean> {
  return request<boolean>("PUT", `/api/auth/${providerID}`, credentials);
}

// Abort

export async function abortSession(id: string): Promise<boolean> {
  return request<boolean>("POST", `/api/session/${id}/abort`);
}

// ── Authenticated fetch helper ──────────────────────────────

export function createAuthenticatedFetch(): typeof fetch {
  const keys = loadKeys();
  const token = keys.opencode_token;

  return (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };
}
