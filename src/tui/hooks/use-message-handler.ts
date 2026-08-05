import { useCallback, useRef } from "react";
import { existsSync, readFileSync } from "node:fs";
import { getModelById, getModelProvider } from "../models.js";
import { loadKeys } from "../../api/keys.js";
import { logger } from "../../api/logger.js";
import { systemPromptFor, decorateOpenCodePrompt } from "../../api/prompts.js";
import { CHAT_TOOLS } from "../../api/chat-tools.js";
import { executeTool } from "../../api/tools.js";
import { diffLines } from "../../api/diff.js";
import { loadTodos } from "../../tools/todo.js";
import type { AppState, ChatMessage, FileChange, FileEdit } from "../state.js";
import type { SessionError } from "../../api/logger.js";
import type { Session } from "../../api/opencode.js";
import type {
  ChatMessage as WireMessage,
  ToolCall,
  ToolCallDelta,
} from "../../api/kilocode.js";

/** No chunk for this long means the stream is dead. */
const CHUNK_TIMEOUT_MS = 60_000;

/**
 * Cap on tool round-trips per user message. Without a cap a model that keeps
 * calling think() would loop forever.
 */
const MAX_TOOL_ITERATIONS = 8;

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Reads a file for diffing; unreadable or binary files diff as empty. */
function readFileSafe(path: string): string {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return "";
  }
}

/** Accumulates streamed tool-call fragments, keyed by their stream index. */
interface AccumulatedToolCall {
  id: string;
  name: string;
  args: string;
}

interface ExecutedToolCall {
  content: string;
  detail?: string;
  isError: boolean;
}

type FileAction = "created" | "modified" | "deleted";

function fileMutationFor(
  toolName: string,
): { action: FileAction; trackLines: boolean } | null {
  switch (toolName) {
    case "write":
      return { action: "modified", trackLines: true };
    case "edit":
      return { action: "modified", trackLines: true };
    case "create_file":
      return { action: "created", trackLines: true };
    case "create_directory":
      return { action: "created", trackLines: false };
    case "delete_file":
      return { action: "deleted", trackLines: false };
    case "delete_directory":
      return { action: "deleted", trackLines: false };
    default:
      return null;
  }
}

function toolDetail(args: Record<string, unknown>, output: string): string {
  for (const key of ["path", "command", "url", "pattern", "action"]) {
    const value = args[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return output.split("\n", 1)[0] ?? "";
}

/**
 * Merges a batch of tool-call deltas into the accumulator.
 *
 * Arguments arrive split across chunks, so a single fragment is usually invalid
 * JSON. The previous implementation parsed each fragment independently, which
 * meant any tool taking a non-trivial argument (such as think()) silently threw.
 */
function accumulateToolCalls(
  acc: Map<number, AccumulatedToolCall>,
  deltas: ToolCallDelta[],
): void {
  for (let i = 0; i < deltas.length; i++) {
    const delta = deltas[i];
    const key = delta.index ?? i;
    const existing = acc.get(key) ?? { id: "", name: "", args: "" };

    if (delta.id) existing.id = delta.id;
    if (delta.function?.name) existing.name = delta.function.name;
    if (delta.function?.arguments) existing.args += delta.function.arguments;

    acc.set(key, existing);
  }
}

function parseArgs(raw: string): Record<string, unknown> {
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export interface MessageHandlerDeps {
  state: AppState;
  dispatch: React.Dispatch<any>;
  sessionErrors: React.MutableRefObject<SessionError[]>;
  setFileNotifications: React.Dispatch<
    React.SetStateAction<{ filePath: string; action: "created" | "modified" | "deleted" }[]>
  >;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
}

export function useMessageHandler({
  state,
  dispatch,
  sessionErrors,
  setFileNotifications,
  abortControllerRef,
}: MessageHandlerDeps) {
  const currentModel = getModelById(state.modelId);

  /**
   * Per-turn reasoning tracker. Reasoning (a reasoning stream or the think()
   * tool) is shown live in the Thinking indicator only; when the turn ends a
   * single collapsed "Thought for Ns" entry is written to the transcript,
   * carrying the thought text so it can be expanded on demand (ctrl+t).
   */
  const thinkingRef = useRef<{ seen: boolean; since: number; endedAt: number | null; text: string }>({
    seen: false,
    since: 0,
    endedAt: null,
    text: "",
  });

  const markThinking = useCallback((text?: string) => {
    thinkingRef.current.seen = true;
    if (text) thinkingRef.current.text += text;
  }, []);

  const markThinkingEnded = useCallback(() => {
    if (thinkingRef.current.endedAt === null) {
      thinkingRef.current.endedAt = Date.now();
    }
  }, []);

  /**
   * Writes the collapsed thought entry for the current turn, if any reasoning
   * happened. Called BEFORE the assistant message is appended so the entry
   * sits above the answer it produced, and once more from the finally block
   * to cover aborted/error turns.
   */
  const flushThinking = useCallback(() => {
    const t = thinkingRef.current;
    if (!t.seen) return;
    const end = t.endedAt ?? Date.now();
    dispatch({
      type: "ADD_MESSAGE",
      message: {
        id: genId(),
        role: "thinking",
        content: "",
        thinking: t.text.trim() || undefined,
        thinkingMs: Math.max(0, end - t.since),
        timestamp: Date.now(),
      },
    });
    thinkingRef.current = { seen: false, since: 0, endedAt: null, text: "" };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abortStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, [abortControllerRef]);

  const handleSendMessage = useCallback(
    async (content: string) => {
      const userMsg: ChatMessage = {
        id: genId(),
        role: "user",
        content,
        timestamp: Date.now(),
      };
      dispatch({ type: "ADD_MESSAGE", message: userMsg });
      dispatch({ type: "SET_STREAMING", streaming: true });
      thinkingRef.current = { seen: false, since: Date.now(), endedAt: null, text: "" };

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const provider = getModelProvider(state.modelId);
        if (provider === "opencode") {
          await handleOpenCodeMessage(content, controller.signal);
        } else {
          await handleKiloMessage(content, controller.signal);
        }
      } catch (err) {
        if (controller.signal.aborted) {
          dispatch({
            type: "ADD_MESSAGE",
            message: {
              id: genId(),
              role: "system",
              content: "Interrupted.",
              timestamp: Date.now(),
            },
          });
          return;
        }

        const errorMsg = err instanceof Error ? err.message : String(err);
        const provider = getModelProvider(state.modelId);
        logger.error("chat", errorMsg);
        dispatch({ type: "SET_ERROR", error: errorMsg });
        sessionErrors.current.push({
          timestamp: Date.now(),
          model: currentModel?.name ?? state.modelId,
          message: errorMsg,
          type: provider,
        });
        dispatch({
          type: "ADD_MESSAGE",
          message: {
            id: genId(),
            role: "system",
            content: `Error: ${errorMsg}`,
            timestamp: Date.now(),
          },
        });
      } finally {
        abortControllerRef.current = null;
        // Collapse the turn's reasoning into a single transcript line. The
        // thought text itself was only ever shown in the live indicator.
        if (thinkingRef.current.seen) {
          const end = thinkingRef.current.endedAt ?? Date.now();
          dispatch({
            type: "ADD_MESSAGE",
            message: {
              id: genId(),
              role: "thinking",
              content: "",
              thinkingMs: Math.max(0, end - thinkingRef.current.since),
              timestamp: Date.now(),
            },
          });
        }
        thinkingRef.current = { seen: false, since: 0, endedAt: null, text: "" };
        dispatch({ type: "SET_STREAMING", streaming: false });
      }
    },
    [state.modelId, state.messages, state.contextTokensUsed, state.mode, currentModel],
  );

  /** Conversation history in wire format, excluding UI-only entries. */
  function historyMessages(): WireMessage[] {
    return state.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      }));
  }

  function recordUsage(promptText: string, reply: string) {
    const estimated =
      state.contextTokensUsed + reply.length / 4 + promptText.length / 4;
    dispatch({
      type: "SET_CONTEXT_TOKENS",
      used: Math.round(estimated),
      max: currentModel?.maxContext ?? 131072,
    });
  }

  async function confirmPlanIfNeeded() {
    if (state.mode !== "plan") return;
    const proceed = await new Promise<boolean>((resolve) => {
      dispatch({
        type: "SET_PENDING_PLAN",
        plan: { id: genId(), content: "", resolve },
      });
    });
    dispatch({ type: "SET_PENDING_PLAN", plan: null });
    if (proceed) dispatch({ type: "SET_MODE", mode: "build" });
  }

  // ── Tool execution ────────────────────────────────────────

  /**
   * Runs one tool call and returns the string handed back to the model.
   * Also surfaces the call in the transcript so the user can see what happened.
   */
  async function runToolCall(
    call: AccumulatedToolCall,
    fileChanges: FileChange[],
    signal: AbortSignal,
  ): Promise<ExecutedToolCall> {
    const args = parseArgs(call.args);
    const toolName = call.name === "write_file" ? "write" : call.name;

    // In-flight state lives in the live region, not the transcript, so the
    // spinner can animate and then disappear. Exactly one finished row is
    // appended to the transcript per call.
    dispatch({
      type: "SET_ACTIVE_TOOL",
      tool: { name: toolName, detail: toolDetail(args, "") },
    });

    const finishActivity = (content: string, isError: boolean) => {
      dispatch({ type: "SET_ACTIVE_TOOL", tool: null });
      dispatch({
        type: "ADD_MESSAGE",
        message: {
          id: genId(),
          role: "tool",
          content,
          toolName,
          toolStatus: isError ? "error" : "done",
          toolDetail: toolDetail(args, content),
          timestamp: Date.now(),
        },
      });
    };

    switch (toolName) {
      case "think": {
        const thought = typeof args.thought === "string" ? args.thought : "";

        // Reasoning feeds the live Thinking indicator only. It is collapsed
        // into a single "Thought for Ns" line when the turn ends — never
        // written into the chat as content.
        if (thought) {
          markThinking();
          dispatch({ type: "SET_THINKING", thinking: true, label: "Thinking" });
          dispatch({
            type: "APPEND_THINKING_TEXT",
            text: thought + "\n",
          });
        }

        const result = await executeTool(
          { id: call.id || genId(), name: toolName, arguments: args },
          { directory: process.cwd(), abort: signal },
        );
        finishActivity(result.content, !!result.isError);
        return { content: result.content, isError: !!result.isError };
      }

      case "ask": {
        const question = typeof args.question === "string" ? args.question : "";
        const options = Array.isArray(args.options)
          ? (args.options as unknown[]).filter((o): o is string => typeof o === "string")
          : undefined;

        if (!question) {
          finishActivity("missing question", true);
          return {
            content: "Error: the `question` parameter is required.",
            detail: "missing question",
            isError: true,
          };
        }

        let answer: string;
        try {
          answer = await new Promise<string>((resolve, reject) => {
            const onAbort = () => reject(new Error("Aborted"));
            signal.addEventListener("abort", onAbort, { once: true });

            const finish = (value: string) => {
              signal.removeEventListener("abort", onAbort);
              resolve(value);
            };

            dispatch({
              type: "SET_PENDING_QUESTION",
              question: { id: genId(), question, options, resolve: finish },
            });
          });
        } finally {
          dispatch({ type: "SET_PENDING_QUESTION", question: null });
        }

        finishActivity(answer, false);

        dispatch({
          type: "ADD_MESSAGE",
          message: { id: genId(), role: "user", content: answer, timestamp: Date.now() },
        });
        return { content: answer, detail: answer, isError: false };
      }

      default: {
        const path = typeof args.path === "string" ? args.path : undefined;
        const mutation = fileMutationFor(toolName);

        // Snapshot the file before the tool runs so the diff is real rather
        // than inferred from the arguments. Line counts derived from the
        // arguments alone were always wrong for edits.
        const existedBefore = path ? existsSync(path) : false;
        const before =
          mutation?.trackLines && path && existedBefore ? readFileSafe(path) : "";

        const result = await executeTool(
          { id: call.id || genId(), name: toolName, arguments: args },
          { directory: process.cwd(), abort: signal },
        );
        const isError = !!result.isError || /^error:/i.test(result.content);

        if (isError) {
          logger.error(toolName, result.content);
        } else if (mutation && path) {
          const action = toolName === "write" && !existedBefore ? "created" : mutation.action;

          let fileEdit: FileEdit = { path, action };
          if (mutation.trackLines) {
            const after = readFileSafe(path);
            const diff = diffLines(before, after, { maxLines: 12, context: 1 });
            fileEdit = {
              path,
              action,
              added: diff.added,
              removed: diff.removed,
              diff: diff.lines,
              truncated: diff.truncated,
            };
            fileChanges.push({ path, added: diff.added, removed: diff.removed });
          }

          setFileNotifications((prev) => [...prev, { filePath: path, action }]);
          dispatch({
            type: "ADD_MESSAGE",
            message: {
              id: genId(),
              role: "file-change",
              content: path,
              filePath: path,
              fileAction: action,
              fileEdit,
              timestamp: Date.now(),
            },
          });
        }

        finishActivity(result.content, isError);

        if (!isError && toolName === "todo") {
          dispatch({ type: "SET_TODOS", todos: await loadTodos() });
        }

        return {
          content: result.content,
          detail: toolDetail(args, result.content),
          isError,
        };
      }
    }
  }

  // ── KiloCode (streaming chat completions) ─────────────────

  async function handleKiloMessage(content: string, signal: AbortSignal) {
    const keys = loadKeys();
    if (!keys.kilo_token) {
      dispatch({
        type: "ADD_MESSAGE",
        message: {
          id: genId(),
          role: "system",
          content:
            "No Kilo API key found. Add your token to ~/.codejet/keys.json, or press ctrl+p to switch to an OpenCode model.",
          timestamp: Date.now(),
        },
      });
      return;
    }

    const { chatCompletionsStream } = await import("../../api/kilocode.js");
    const systemPrompt = systemPromptFor(state.mode);

    const wire: WireMessage[] = [
      { role: "system", content: systemPrompt },
      ...historyMessages(),
      { role: "user", content },
    ];

    const fileChanges: FileChange[] = [];
    const toolNames: string[] = [];
    let visibleContent = "";

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      if (signal.aborted) throw new Error("Aborted");

      const stream = await chatCompletionsStream({
        model: state.modelId,
        messages: wire,
        tools: CHAT_TOOLS,
        tool_choice: "auto",
      });

      const reader = stream.getReader();
      const pendingCalls = new Map<number, AccumulatedToolCall>();
      let iterationText = "";

      try {
        while (true) {
          if (signal.aborted) throw new Error("Aborted");

          let timer: NodeJS.Timeout | undefined;
          const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error("Stream timed out waiting for the model")),
              CHUNK_TIMEOUT_MS,
            );
          });

          let result: Awaited<ReturnType<typeof reader.read>>;
          try {
            result = await Promise.race([reader.read(), timeout]);
          } finally {
            if (timer) clearTimeout(timer);
          }

          if (result.done) break;

          const choice = result.value.choices?.[0];
          const delta = choice?.delta;
          if (!delta) continue;

          // Reasoning channel: shown in the Thinking indicator, never mixed
          // into the visible answer.
          const reasoning = delta.reasoning ?? delta.reasoning_content;
          if (reasoning) {
            markThinking();
            dispatch({ type: "APPEND_THINKING_TEXT", text: reasoning });
            dispatch({ type: "SET_THINKING", thinking: true, label: "Thinking" });
          }

          if (delta.content) {
            markThinkingEnded();
            iterationText += delta.content;
            dispatch({
              type: "SET_STREAMING_CONTENT",
              content: visibleContent + iterationText,
            });
          }

          if (delta.tool_calls) {
            accumulateToolCalls(pendingCalls, delta.tool_calls);
          }
        }
      } finally {
        reader.cancel().catch(() => {});
      }

      visibleContent += iterationText;

      const calls = [...pendingCalls.values()].filter((c) => c.name);

      // No tools requested: the turn is finished.
      if (calls.length === 0) break;

      // Record the assistant turn (including its tool calls) before results.
      const wireToolCalls: ToolCall[] = calls.map((c) => ({
        id: c.id || genId(),
        type: "function" as const,
        function: { name: c.name, arguments: c.args || "{}" },
      }));
      wire.push({
        role: "assistant",
        content: iterationText || null,
        tool_calls: wireToolCalls,
      });

      for (let i = 0; i < calls.length; i++) {
        const call = calls[i];
        toolNames.push(call.name);

        // runToolCall already appends exactly one finished transcript row.
        const executed = await runToolCall(call, fileChanges, signal);

        wire.push({
          role: "tool",
          content: executed.content,
          tool_call_id: wireToolCalls[i].id,
          name: call.name,
        });
      }

      // Loop again so the model can act on the tool results.
      dispatch({ type: "SET_THINKING", thinking: true, label: "Thinking" });
    }

    if (visibleContent.trim()) {
      dispatch({
        type: "ADD_MESSAGE",
        message: {
          id: genId(),
          role: "assistant",
          content: visibleContent,
          timestamp: Date.now(),
          modelName: currentModel?.name,
          toolCalls: toolNames.length > 0 ? toolNames : undefined,
          fileChanges: fileChanges.length > 0 ? fileChanges : undefined,
        },
      });
      recordUsage(content, visibleContent);
      await confirmPlanIfNeeded();
    } else if (toolNames.length === 0) {
      throw new Error("The model returned an empty response.");
    }
  }

  // ── OpenCode (server-side agent, polled) ──────────────────

  async function handleOpenCodeMessage(content: string, signal: AbortSignal) {
    const ocServer = await import("../../api/opencode-server.js");

    if (!ocServer.isServerReady()) {
      dispatch({ type: "SET_ACTIVITY_LABEL", label: "Connecting to OpenCode" });
      const ready = await ocServer.waitForServer(10000);
      if (!ready) {
        const serverErr = ocServer.getLastError();
        dispatch({ type: "SET_ACTIVITY_LABEL", label: "Starting OpenCode server" });
        const startOk = await ocServer.startServer();
        if (!startOk) {
          const detail = serverErr ? `\n\nServer error: ${serverErr}` : "";
          throw new Error(
            "Could not connect to the OpenCode server.\n\n" +
              "Things to try:\n" +
              "- Make sure `opencode` is installed and on PATH\n" +
              "- Run `opencode serve` manually in another terminal\n" +
              "- Press ctrl+p and switch to a KiloCode model" +
              detail,
          );
        }
      }
    }

    const oc = await import("../../api/opencode.js");

    let session: Session;
    try {
      session = await oc.createSession(undefined, "CodeJet Session");
    } catch (err) {
      const sessions = await oc.listSessions().catch(() => [] as Session[]);
      if (sessions.length === 0) {
        throw new Error(
          `Failed to create an OpenCode session: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      session = sessions[0];
    }

    const promptText = decorateOpenCodePrompt(content, state.mode);
    const ocModel = state.modelId.replace("opencode/", "");

    dispatch({ type: "SET_THINKING", thinking: true, label: "Thinking" });
    markThinking();

    let sent: Awaited<ReturnType<typeof oc.sendMessage>>;
    try {
      let timer: NodeJS.Timeout | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Timed out sending the message to OpenCode (30s)")),
          30000,
        );
        signal.addEventListener("abort", () => reject(new Error("Aborted")), { once: true });
      });
      try {
        sent = await Promise.race([
          oc.sendMessage(session.id, [{ type: "text", content: promptText }], { model: ocModel }),
          timeout,
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    } catch (err) {
      if (signal.aborted) throw new Error("Aborted");
      throw new Error(
        `Failed to send the message: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const assistantMsg = await oc.waitForAssistantMessage(
      session.id,
      sent.id,
      sent.timeCreated,
      120000,
      1500,
    );

    if (signal.aborted) throw new Error("Aborted");

    const reply = assistantMsg ? oc.getMessageText(assistantMsg) : "";
    markThinkingEnded();
    if (!reply.trim()) {
      throw new Error(`OpenCode did not return a response from ${ocModel} within 120 seconds.`);
    }

    dispatch({
      type: "ADD_MESSAGE",
      message: {
        id: genId(),
        role: "assistant",
        content: reply,
        timestamp: Date.now(),
        modelName: currentModel?.name,
      },
    });
    recordUsage(content, reply);
    await confirmPlanIfNeeded();
  }

  return { handleSendMessage, abortStream };
}
