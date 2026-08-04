import { useCallback, useRef } from "react";
import { getModelById, getModelProvider } from "../models.js";
import { loadKeys } from "../../api/keys.js";
import type { AppState, ChatMessage, FileChange } from "../state.js";

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export interface MessageHandlerDeps {
  state: AppState;
  dispatch: React.Dispatch<any>;
  sessionErrors: React.MutableRefObject<{ timestamp: number; model: string; message: string }[]>;
  setFileNotifications: React.Dispatch<React.SetStateAction<{ filePath: string; action: "created" | "modified" | "deleted" }[]>>;
}

export function useMessageHandler({
  state,
  dispatch,
  sessionErrors,
  setFileNotifications,
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

      try {
        const provider = getModelProvider(state.modelId);

        if (provider === "opencode") {
          await handleOpenCodeMessage(content);
        } else {
          await handleKiloMessage(content);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        dispatch({ type: "SET_ERROR", error: errorMsg });
        sessionErrors.current.push({
          timestamp: Date.now(),
          model: currentModel?.name ?? state.modelId,
          message: errorMsg,
        });
        const errChatMsg: ChatMessage = {
          id: genId(),
          role: "system",
          content: `Error: ${errorMsg}`,
          timestamp: Date.now(),
        };
        dispatch({ type: "ADD_MESSAGE", message: errChatMsg });
      } finally {
        dispatch({ type: "SET_STREAMING", streaming: false });
      }
    },
    [state.modelId, state.messages, state.contextTokensUsed, currentModel],
  );

  async function handleOpenCodeMessage(content: string) {
    const ocServer = await import("../../api/opencode-server.js");

    if (!ocServer.isServerReady()) {
      const ready = await ocServer.waitForServer(5000);
      if (!ready) {
        throw new Error(
          "OpenCode server is not running. " +
          "Try restarting codejet, or switch to a KiloCode model (Ctrl+P → Switch Model)."
        );
      }
    }

    const oc = await import("../../api/opencode.js");
    const session = await oc.createSession(undefined, "CodeJet Session");

    const parts = [
      { type: "text" as const, content },
    ];

    const ocModel = state.modelId.replace("opencode/", "");
    const response = await oc.sendMessage(session.id, parts, { model: ocModel });

    let fullContent = "";
    for (const part of response.parts) {
      if (part.type === "text" && part.content) {
        fullContent += part.content;
      }
    }

    if (fullContent) {
      dispatch({ type: "SET_STREAMING_CONTENT", content: fullContent });
      const assistantMsg: ChatMessage = {
        id: genId(),
        role: "assistant",
        content: fullContent,
        timestamp: Date.now(),
        modelName: currentModel?.name,
      };
      dispatch({ type: "ADD_MESSAGE", message: assistantMsg });

      const estimatedTokens = state.contextTokensUsed + fullContent.length / 4 + content.length / 4;
      dispatch({
        type: "SET_CONTEXT_TOKENS",
        used: Math.round(estimatedTokens),
        max: currentModel?.maxContext ?? 131072,
      });
    } else {
      throw new Error("OpenCode returned an empty response");
    }
  }

  async function handleKiloMessage(content: string) {
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

    const { chatCompletionsStream } = await import("../../api/kilocode.js");
    const stream = await chatCompletionsStream({
      model: state.modelId,
      messages: [
        {
          role: "system",
          content:
            "You are CodeJet, an AI coding assistant. You help users with software engineering tasks. When you need to ask the user a question, use the ask tool. When you create or modify files, describe what you did.",
        },
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

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const delta = value.choices?.[0]?.delta;
      if (delta?.content) {
        fullContent += delta.content;
        dispatch({ type: "SET_STREAMING_CONTENT", content: fullContent });
      }
      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.function?.name) {
            toolCalls.push(tc.function.name);
          }
          if (tc.function?.name === "ask") {
            try {
              const args = JSON.parse(tc.function.arguments);
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
            } catch {}
          }
          if (tc.function?.name === "write_file") {
            try {
              const args = JSON.parse(tc.function.arguments);
              setFileNotifications((prev) => [
                ...prev,
                { filePath: args.path, action: "created" as const },
              ]);
              fileChanges.push({ path: args.path, added: args.content?.split("\n").length ?? 0, removed: 0 });
            } catch {}
          }
        }
      }
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
    }
  }

  return { handleSendMessage };
}
