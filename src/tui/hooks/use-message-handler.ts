import { useCallback, useRef } from "react";
import { getModelById, getModelProvider } from "../models.js";
import { loadKeys } from "../../api/keys.js";
import { logger } from "../../api/logger.js";
import type { AppState, ChatMessage, FileChange } from "../state.js";
import type { SessionError } from "../../api/logger.js";
import type { Session } from "../../api/opencode.js";

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export interface MessageHandlerDeps {
  state: AppState;
  dispatch: React.Dispatch<any>;
  sessionErrors: React.MutableRefObject<SessionError[]>;
  setFileNotifications: React.Dispatch<React.SetStateAction<{ filePath: string; action: "created" | "modified" | "deleted" }[]>>;
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
      dispatch({ type: "SET_STREAMING_CONTENT", content: "" });

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
        if (controller.signal.aborted) return;
        const errorMsg = err instanceof Error ? err.message : String(err);
        const provider = getModelProvider(state.modelId);
        dispatch({ type: "SET_ERROR", error: errorMsg });
        sessionErrors.current.push({
          timestamp: Date.now(),
          model: currentModel?.name ?? state.modelId,
          message: errorMsg,
          type: provider,
        });
        const errChatMsg: ChatMessage = {
          id: genId(),
          role: "system",
          content: `Error: ${errorMsg}`,
          timestamp: Date.now(),
        };
        dispatch({ type: "ADD_MESSAGE", message: errChatMsg });
      } finally {
        abortControllerRef.current = null;
        dispatch({ type: "SET_STREAMING", streaming: false });
      }
    },
    [state.modelId, state.messages, state.contextTokensUsed, state.mode, currentModel],
  );

  const abortStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, [abortControllerRef]);

  async function handleOpenCodeMessage(content: string, signal: AbortSignal) {
    const ocServer = await import("../../api/opencode-server.js");

    if (!ocServer.isServerReady()) {
      // Try to wait for server, but with streaming feedback
      dispatch({ type: "SET_STREAMING_CONTENT", content: "Connecting to OpenCode server..." });
      const ready = await ocServer.waitForServer(10000);
      if (!ready) {
        const serverErr = ocServer.getLastError();

        // Try one more time to start the server
        dispatch({ type: "SET_STREAMING_CONTENT", content: "Starting OpenCode server..." });
        const startOk = await ocServer.startServer();
        if (!startOk) {
          const detail = serverErr ? `\n\nServer error: ${serverErr}` : "";
          throw new Error(
            "Could not connect to OpenCode server.\n\n" +
            "Possible fixes:\n" +
            "• Make sure 'opencode' is installed and on PATH\n" +
            "• Try running 'opencode serve' manually in another terminal\n" +
            "• Switch to a KiloCode model (Ctrl+P → Switch Model)" +
            detail
          );
        }
      }
    }

    const oc = await import("../../api/opencode.js");

    // Always create a fresh session to avoid stale state
    let session: Session;
    try {
      session = await oc.createSession(undefined, "CodeJet Session");
    } catch (err) {
      // If creating fails, try listing existing
      try {
        const sessions = await oc.listSessions();
        if (sessions.length > 0) {
          session = sessions[0];
        } else {
          throw err;
        }
      } catch {
        throw new Error(`Failed to create OpenCode session: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const promptText = state.mode === "plan"
      ? `[PLAN MODE] Create a detailed implementation plan for: ${content}. Break into steps, describe files/functions, order of operations. Do NOT write code.`
      : content;

    const ocModel = state.modelId.replace("opencode/", "");

    dispatch({ type: "SET_STREAMING_CONTENT", content: "Sending to model..." });

    // Send the message
    try {
      const sendPromise = oc.sendMessage(session.id, [{ type: "text", content: promptText }], { model: ocModel });
      const timeoutPromise = new Promise<never>((_, reject) => {
        const id = setTimeout(() => reject(new Error("Timed out sending message to OpenCode (30s)")), 30000);
        signal.addEventListener("abort", () => { clearTimeout(id); reject(new Error("Aborted")); }, { once: true });
      });

      await Promise.race([sendPromise, timeoutPromise]);
    } catch (err) {
      if (signal.aborted) throw new Error("Aborted");
      throw new Error(`Failed to send message: ${err instanceof Error ? err.message : String(err)}`);
    }

    dispatch({ type: "SET_STREAMING_CONTENT", content: "Waiting for response..." });

    // Poll for response with visual feedback
    const pollStart = Date.now();
    const deadline = pollStart + 120000; // 2 minutes
    let fullContent = "";
    let lastPollContent = "";

    while (Date.now() < deadline) {
      if (signal.aborted) throw new Error("Aborted");

      try {
        const msgs = await oc.listMessages(session.id, 20);

        // Find assistant messages
        const assistantMsgs = msgs.filter(
          (m) => m.type === "assistant" || m.role === "assistant",
        );

        if (assistantMsgs.length > 0) {
          const last = assistantMsgs[assistantMsgs.length - 1];
          const text = last.text ?? last.parts?.map((p) => p.content ?? p.text ?? "").join("") ?? "";

          if (text && text.trim().length > 0) {
            fullContent = text;
            // Show progressive content while waiting
            dispatch({ type: "SET_STREAMING_CONTENT", content: fullContent });

            // Check if the message is complete (has completion time or no new content after 3s)
            if (last.time?.completed) {
              break;
            }

            // If content hasn't changed in 3 seconds, assume complete
            if (lastPollContent === fullContent) {
              break;
            }
            lastPollContent = fullContent;
          }
        }
      } catch {
        // Polling error - keep trying
      }

      // Show elapsed time in streaming content
      const elapsed = Math.round((Date.now() - pollStart) / 1000);
      if (!fullContent && elapsed > 5) {
        dispatch({ type: "SET_STREAMING_CONTENT", content: `Waiting for ${ocModel} response... (${elapsed}s)` });
      }

      await new Promise((r) => setTimeout(r, 1500));
    }

    if (fullContent) {
      dispatch({ type: "SET_STREAMING_CONTENT", content: fullContent });
      const assistantMsgChat: ChatMessage = {
        id: genId(),
        role: "assistant",
        content: fullContent,
        timestamp: Date.now(),
        modelName: currentModel?.name,
      };
      dispatch({ type: "ADD_MESSAGE", message: assistantMsgChat });

      const estimatedTokens = state.contextTokensUsed + fullContent.length / 4 + content.length / 4;
      dispatch({
        type: "SET_CONTEXT_TOKENS",
        used: Math.round(estimatedTokens),
        max: currentModel?.maxContext ?? 131072,
      });

      if (state.mode === "plan") {
        const proceed = await new Promise<boolean>((resolve) => {
          dispatch({
            type: "SET_PENDING_PLAN",
            plan: {
              id: genId(),
              content: fullContent,
              resolve,
            },
          });
        });
        dispatch({ type: "SET_PENDING_PLAN", plan: null });
        if (proceed) {
          dispatch({ type: "SET_MODE", mode: "build" });
        }
      }
    } else {
      throw new Error("OpenCode returned an empty response. The model may have encountered an issue.");
    }
  }

  async function handleKiloMessage(content: string, signal: AbortSignal) {
    const keys = loadKeys();

    if (!keys.kilo_token) {
      const assistantMsg: ChatMessage = {
        id: genId(),
        role: "assistant",
        content: "[No Kilo API key found. Set your Kilo token in ~/.codejet/keys.json]",
        timestamp: Date.now(),
        modelName: currentModel?.name,
      };
      dispatch({ type: "ADD_MESSAGE", message: assistantMsg });
      return;
    }

    const systemPrompt = state.mode === "plan"
      ? "You are CodeJet in PLAN mode. The user will describe a coding task or project. Your job is to create a detailed implementation plan. Break the task into clear, actionable steps. Describe what files to create/modify, what functions to write, and the order of operations. Do NOT write code or make changes — only plan. When the user confirms, the plan will be handed to build mode for execution."
      : "You are CodeJet, an AI coding assistant. You help users with software engineering tasks. When you need to ask the user a question, use the ask tool. When you create or modify files, describe what you did.";

    const { chatCompletionsStream } = await import("../../api/kilocode.js");

    // Helper to continue conversation with tool results
    const continueWithToolResults = async (
      toolCallResults: Array<{ toolCallId: string; content: string; name: string }>
    ): Promise<string> => {
      // Send tool results back to the model and get the next response
      const toolMessages = toolCallResults.map((tc) => ({
        role: "tool" as const,
        tool_call_id: tc.toolCallId,
        content: tc.content,
      }));

      const continueStream = await chatCompletionsStream({
        model: state.modelId,
        messages: [
          { role: "system", content: systemPrompt },
          ...state.messages.map((m) => ({
            role: m.role === "user" ? ("user" as const) : ("assistant" as const),
            content: m.content,
          })),
          { role: "user" as const, content },
          ...toolMessages,
        ],
        tools: [
          {
            type: "function" as const,
            function: {
              name: "ask",
              description: "Ask the user a question",
              parameters: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  options: { type: "array", items: { type: "string" } },
                },
                required: ["question"],
              },
            },
          },
          {
            type: "function" as const,
            function: {
              name: "write_file",
              description: "Write content to a file",
              parameters: {
                type: "object",
                properties: {
                  path: { type: "string" },
                  content: { type: "string" },
                },
                required: ["path", "content"],
              },
            },
          },
        ],
      });

      // Collect all the content from the continuation
      let continuationContent = "";
      const reader = continueStream.getReader();

      try {
        while (true) {
          if (signal.aborted) break;

          const chunkPromise = reader.read();
          const timeoutPromise = new Promise<never>((_, reject) => {
            const id = setTimeout(() => reject(new Error("Stream timed out (no chunk received for 30s)")), CHUNK_TIMEOUT_MS);
            signal.addEventListener("abort", () => { clearTimeout(id); reject(new Error("Aborted")); }, { once: true });
          });

          const { done, value } = await Promise.race([chunkPromise, timeoutPromise]);
          if (done) break;

          const delta = value.choices?.[0]?.delta;
          if (delta?.content) {
            continuationContent += delta.content;
            dispatch({ type: "SET_STREAMING_CONTENT", content: fullContent + continuationContent });
          }
          // Handle nested tool calls in continuation
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.function?.name) {
                toolCalls.push(tc.function.name);
              }
              // Handle tool calls recursively
              if (tc.function?.name === "ask" || tc.function?.name === "write_file") {
                const args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
                if (tc.function.name === "ask") {
                  const answer = await new Promise<string>((resolve) => {
                    dispatch({
                      type: "SET_PENDING_QUESTION",
                      question: {
                        id: genId(),
                        question: args.question,
                        options: args.options,
                        resolve,
                      },
                    });
                  });
                  dispatch({ type: "SET_PENDING_QUESTION", question: null });
                  const answerMsg: ChatMessage = {
                    id: genId(),
                    role: "user",
                    content: answer,
                    timestamp: Date.now(),
                  };
                  dispatch({ type: "ADD_MESSAGE", message: answerMsg });
                }
                if (tc.function.name === "write_file") {
                  setFileNotifications((prev) => [
                    ...prev,
                    { filePath: args.path, action: "created" as const },
                  ]);
                  fileChanges.push({ path: args.path, added: args.content?.split("\n").length ?? 0, removed: 0 });
                }
              }
            }
          }
        }
      } finally {
        reader.cancel().catch(() => {});
      }

      return continuationContent;
    };

    const stream = await chatCompletionsStream({
      model: state.modelId,
      messages: [
        { role: "system", content: systemPrompt },
        ...state.messages.map((m) => ({
          role: m.role === "user" ? ("user" as const) : ("assistant" as const),
          content: m.content,
        })),
        { role: "user" as const, content },
      ],
      tools: [
        {
          type: "function" as const,
          function: {
            name: "ask",
            description: "Ask the user a question",
            parameters: {
              type: "object",
              properties: {
                question: { type: "string" },
                options: { type: "array", items: { type: "string" } },
              },
              required: ["question"],
            },
          },
        },
        {
          type: "function" as const,
          function: {
            name: "write_file",
            description: "Write content to a file",
            parameters: {
              type: "object",
              properties: {
                path: { type: "string" },
                content: { type: "string" },
              },
              required: ["path", "content"],
            },
          },
        },
      ],
    });

    const reader = stream.getReader();
    let fullContent = "";
    const toolCalls: string[] = [];
    const fileChanges: FileChange[] = [];
    const CHUNK_TIMEOUT_MS = 30_000;

    try {
      while (true) {
        if (signal.aborted) break;

        const chunkPromise = reader.read();
        const timeoutPromise = new Promise<never>((_, reject) => {
          const id = setTimeout(() => reject(new Error("Stream timed out (no chunk received for 30s)")), CHUNK_TIMEOUT_MS);
          signal.addEventListener("abort", () => { clearTimeout(id); reject(new Error("Aborted")); }, { once: true });
        });

        const { done, value } = await Promise.race([chunkPromise, timeoutPromise]);
        if (done) break;

        const delta = value.choices?.[0]?.delta;
        if (delta?.content) {
          fullContent += delta.content;
          dispatch({ type: "SET_STREAMING_CONTENT", content: fullContent });
        }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const toolCallId = tc.id ?? genId();
            if (tc.function?.name) {
              toolCalls.push(tc.function.name);
            }

            // Execute the tool and collect results
            let toolResultContent = "";
            if (tc.function?.name === "ask") {
              try {
                const args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
                const answer = await new Promise<string>((resolve) => {
                  dispatch({
                    type: "SET_PENDING_QUESTION",
                    question: {
                      id: genId(),
                      question: args.question,
                      options: args.options,
                      resolve,
                    },
                  });
                });
                dispatch({ type: "SET_PENDING_QUESTION", question: null });

                // Add user's answer as a message
                const answerMsg: ChatMessage = {
                  id: genId(),
                  role: "user",
                  content: answer,
                  timestamp: Date.now(),
                };
                dispatch({ type: "ADD_MESSAGE", message: answerMsg });
                toolResultContent = answer;
              } catch (err) {
                console.error("[ask tool] Error:", err);
                toolResultContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
              }
            }

            // Handle write_file tool
            if (tc.function?.name === "write_file") {
              try {
                const args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
                setFileNotifications((prev) => [
                  ...prev,
                  { filePath: args.path, action: "modified" as const },
                ]);
                fileChanges.push({ path: args.path, added: args.content?.split("\n").length ?? 0, removed: 0 });
                toolResultContent = `File written: ${args.path}`;
              } catch (err) {
                console.error("[write_file tool] Error:", err);
                toolResultContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
              }
            }

            // If we have a tool call that expects a result, continue the conversation
            if (toolResultContent || tc.function?.name) {
              // Continue the conversation with tool results
              const continuation = await continueWithToolResults([{
                toolCallId,
                content: toolResultContent || "Tool executed successfully",
                name: tc.function?.name || "unknown",
              }]);
              fullContent += continuation;
              // Continue the loop to get more content if available
              continue;
            }
          }
        }
      }
    } finally {
      reader.cancel().catch(() => {});
    }

    if (fullContent) {
      const assistantMsg: ChatMessage = {
        id: genId(),
        role: "assistant",
        content: fullContent,
        timestamp: Date.now(),
        modelName: currentModel?.name,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        fileChanges: fileChanges.length > 0 ? fileChanges : undefined,
      };
      dispatch({ type: "ADD_MESSAGE", message: assistantMsg });

      const estimatedTokens = state.contextTokensUsed + fullContent.length / 4 + content.length / 4;
      dispatch({
        type: "SET_CONTEXT_TOKENS",
        used: Math.round(estimatedTokens),
        max: currentModel?.maxContext ?? 131072,
      });

      if (state.mode === "plan") {
        const proceed = await new Promise<boolean>((resolve) => {
          dispatch({
            type: "SET_PENDING_PLAN",
            plan: {
              id: genId(),
              content: fullContent,
              resolve,
            },
          });
        });
        dispatch({ type: "SET_PENDING_PLAN", plan: null });
        if (proceed) {
          dispatch({ type: "SET_MODE", mode: "build" });
        }
      }
    }
  }

  return { handleSendMessage, abortStream };
}
