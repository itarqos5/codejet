import type { Tool } from "./kilocode.js";
import { thinkTool } from "../tools/think.js";
import { toKiloTool } from "./tools.js";

/**
 * Tool schemas advertised on the chat-completions path.
 *
 * Only tools the chat loop actually executes are advertised here. Offering a
 * schema the loop cannot handle leaves the model waiting for a tool result that
 * never arrives, which stalls the turn.
 *
 * `think` is derived from its ToolDefinition so the schema and the executable
 * implementation can never disagree.
 */

export const ASK_TOOL_SCHEMA: Tool = {
  type: "function",
  function: {
    name: "ask",
    description:
      "Ask the user a question when you need information or a decision you cannot safely infer. Provide options when the answer is a choice from a small set.",
    parameters: {
      type: "object",
      properties: {
        question: { type: "string", description: "The question to ask." },
        options: {
          type: "array",
          items: { type: "string" },
          description: "Optional list of choices to offer.",
        },
      },
      required: ["question"],
    },
  },
};

export const WRITE_FILE_TOOL_SCHEMA: Tool = {
  type: "function",
  function: {
    name: "write_file",
    description: "Write content to a file, creating it if it does not exist.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file." },
        content: { type: "string", description: "Full content to write." },
      },
      required: ["path", "content"],
    },
  },
};

export const THINK_TOOL_SCHEMA: Tool = toKiloTool(thinkTool);

/**
 * think() is listed first: models weight earlier tools slightly more heavily,
 * and reasoning before acting is the behaviour we want to encourage.
 */
export const CHAT_TOOLS: Tool[] = [THINK_TOOL_SCHEMA, ASK_TOOL_SCHEMA, WRITE_FILE_TOOL_SCHEMA];

/** Tool names the chat loop knows how to execute. */
export const HANDLED_TOOL_NAMES = new Set(["think", "ask", "write_file"]);
