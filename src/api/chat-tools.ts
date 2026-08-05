import type { Tool } from "./kilocode.js";
import { ALL_TOOLS } from "../tools/index.js";
import { toKiloTools } from "./tools.js";

/**
 * Tool schemas advertised on the chat-completions path.
 *
 * This list is derived from the executable definitions so schemas and
 * implementations cannot drift apart. `think` remains first because ALL_TOOLS
 * deliberately orders it first.
 */
export const CHAT_TOOLS: Tool[] = toKiloTools(ALL_TOOLS);

/** Tool names the chat loop knows how to execute. */
export const HANDLED_TOOL_NAMES = new Set(ALL_TOOLS.map((tool) => tool.name));
