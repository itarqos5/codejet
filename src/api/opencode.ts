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
    headers: { "Content-Type": "application/json" },
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenCode ${method} ${path} failed (${res.status}): ${text}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Types ───────────────────────────────────────────────────

export interface HealthResponse {
  healthy: boolean;
  version: string;
}

export interface Session {
  id: string;
  title: string;
  directory: string;
  parentID?: string;
  time: { created: number; updated: number };
}

export interface MessagePart {
  type: string;
  content?: string;
  [key: string]: unknown;
}

export interface Message {
  info: {
    id: string;
    role: string;
    sessionID: string;
    time: { created: number; completed?: number };
  };
  parts: MessagePart[];
}

export interface ModelInfo {
  id: string;
  modelID: string;
  providerID: string;
  name: string;
  capabilities: {
    tools: boolean;
    input: string[];
    output: string[];
  };
  enabled: boolean;
  limit: { context: number; output: number };
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
  return request<Session[]>("GET", "/session");
}

export async function createSession(parentID?: string, title?: string): Promise<Session> {
  return request<Session>("POST", "/session", { parentID, title });
}

export async function getSession(id: string): Promise<Session> {
  return request<Session>("GET", `/session/${id}`);
}

export async function deleteSession(id: string): Promise<boolean> {
  return request<boolean>("DELETE", `/session/${id}`);
}

export async function updateSession(id: string, title: string): Promise<Session> {
  return request<Session>("PATCH", `/session/${id}`, { title });
}

// Messages

export async function listMessages(sessionID: string, limit?: number): Promise<Message[]> {
  const query = limit != null ? `?limit=${limit}` : "";
  return request<Message[]>("GET", `/session/${sessionID}/messages${query}`);
}

export async function sendMessage(
  sessionID: string,
  parts: MessagePart[],
  opts?: { model?: string; agent?: string },
): Promise<Message> {
  return request<Message>("POST", `/session/${sessionID}/prompt`, {
    parts,
    model: opts?.model,
    agent: opts?.agent,
  });
}

// Models

export async function listModels(): Promise<ModelInfo[]> {
  return request<ModelInfo[]>("GET", "/model");
}

export async function getDefaultModel(): Promise<ModelInfo> {
  return request<ModelInfo>("GET", "/model/default");
}

// Providers

export async function listProviders(): Promise<ProviderInfo[]> {
  return request<ProviderInfo[]>("GET", "/provider");
}

export async function getProviderAuth(
  providerID: string,
): Promise<ProviderAuthMethod[]> {
  return request<ProviderAuthMethod[]>("GET", `/provider/${providerID}/auth`);
}

// Auth

export async function setAuth(
  providerID: string,
  credentials: Record<string, unknown>,
): Promise<boolean> {
  return request<boolean>("PUT", `/auth/${providerID}`, credentials);
}

// Config

export async function getConfig(): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>("GET", "/config");
}

// VCS

export async function getVcsStatus(): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>("GET", "/vcs/status");
}

export async function getVcsDiff(): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>("GET", "/vcs/diff");
}

// Abort

export async function abortSession(id: string): Promise<boolean> {
  return request<boolean>("POST", `/session/${id}/abort`);
}

// Tools

export interface ToolInfo {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export async function listToolIds(): Promise<string[]> {
  return request<string[]>("GET", "/experimental/tool/ids");
}

export async function listTools(
  provider?: string,
  model?: string,
): Promise<ToolInfo[]> {
  const params = new URLSearchParams();
  if (provider) params.set("provider", provider);
  if (model) params.set("model", model);
  const query = params.toString() ? `?${params}` : "";
  return request<ToolInfo[]>("GET", `/experimental/tool${query}`);
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
