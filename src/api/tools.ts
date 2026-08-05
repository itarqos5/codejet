import type {
  ChatMessage as KiloChatMessage,
  Tool as KiloTool,
} from "./kilocode.js";

// ── Unified Tool Types ──────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>, context: ToolContext) => Promise<string>;
}

export interface ToolContext {
  sessionID?: string;
  messageID?: string;
  agent?: string;
  directory?: string;
  worktree?: string;
  abort?: AbortSignal;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
}

// ── Tool Registry ───────────────────────────────────────────

const registry = new Map<string, ToolDefinition>();

export function registerTool(tool: ToolDefinition): void {
  registry.set(tool.name, tool);
}

export function registerTools(tools: ToolDefinition[]): void {
  for (const tool of tools) registry.set(tool.name, tool);
}

export function getTool(name: string): ToolDefinition | undefined {
  return registry.get(name);
}

export function listTools(): ToolDefinition[] {
  return [...registry.values()];
}

export function clearTools(): void {
  registry.clear();
}

// ── Execution ───────────────────────────────────────────────

export async function executeTool(
  call: ToolCall,
  context: ToolContext,
): Promise<ToolResult> {
  const tool = registry.get(call.name);
  if (!tool) {
    return {
      toolCallId: call.id,
      content: `Unknown tool: ${call.name}`,
      isError: true,
    };
  }

  try {
    const output = await tool.execute(call.arguments, context);
    return { toolCallId: call.id, content: output };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { toolCallId: call.id, content: `Tool error: ${message}`, isError: true };
  }
}

export async function executeToolCalls(
  calls: ToolCall[],
  context: ToolContext,
): Promise<ToolResult[]> {
  return Promise.all(calls.map((call) => executeTool(call, context)));
}

// ── Format Conversion ───────────────────────────────────────

export function toKiloTool(tool: ToolDefinition): KiloTool {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}

export function toKiloTools(tools: ToolDefinition[]): KiloTool[] {
  return tools.map(toKiloTool);
}

// ── Agentic Loop (for Kilo client-side tools) ───────────────

export interface AgenticOptions {
  model: string;
  messages: KiloChatMessage[];
  tools?: ToolDefinition[];
  maxIterations?: number;
  context?: ToolContext;
  onMessage?: (message: { role: string; content: string }) => void;
  onToolCall?: (call: ToolCall) => void;
  onToolResult?: (result: ToolResult) => void;
}

export interface AgenticResult {
  messages: KiloChatMessage[];
  iterations: number;
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
}

export async function runAgenticLoop(
  options: AgenticOptions,
): Promise<AgenticResult> {
  const {
    model,
    messages: initialMessages,
    tools = [],
    maxIterations = 10,
    context = {},
    onMessage,
    onToolCall,
    onToolResult,
  } = options;

  // Dynamic import to avoid circular dependencies
  const kilo = await import("./kilocode.js");

  const messages = [...initialMessages];
  const allToolCalls: ToolCall[] = [];
  const allToolResults: ToolResult[] = [];
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;

    const response = await kilo.chatCompletions({
      model,
      messages,
      tools: tools.length > 0 ? toKiloTools(tools) : undefined,
      tool_choice: tools.length > 0 ? "auto" : undefined,
    });

    const choice = response.choices[0];
    if (!choice) break;

    const assistantMessage = choice.message;
    messages.push({
      role: "assistant",
      content: assistantMessage.content ?? "",
      tool_calls: assistantMessage.tool_calls,
    });
    onMessage?.({ role: "assistant", content: assistantMessage.content ?? "" });

    // No tool calls — we're done
    if (!assistantMessage.tool_calls?.length) {
      break;
    }

    // Process tool calls
    for (const tc of assistantMessage.tool_calls) {
      let argumentsValue: Record<string, unknown>;
      try {
        argumentsValue = JSON.parse(tc.function.arguments) as Record<string, unknown>;
      } catch {
        const result: ToolResult = {
          toolCallId: tc.id,
          content: `Tool error: invalid JSON arguments for ${tc.function.name}`,
          isError: true,
        };
        allToolResults.push(result);
        onToolResult?.(result);
        messages.push({
          role: "tool",
          content: result.content,
          tool_call_id: result.toolCallId,
          name: tc.function.name,
        });
        continue;
      }

      const call: ToolCall = {
        id: tc.id,
        name: tc.function.name,
        arguments: argumentsValue,
      };
      allToolCalls.push(call);
      onToolCall?.(call);

      const result = await executeTool(call, context);
      allToolResults.push(result);
      onToolResult?.(result);

      messages.push({
        role: "tool",
        content: result.content,
        tool_call_id: result.toolCallId,
        name: call.name,
      });
    }
  }

  return {
    messages,
    iterations,
    toolCalls: allToolCalls,
    toolResults: allToolResults,
  };
}
