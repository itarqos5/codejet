import { registerTools } from "../api/tools.js";

import { writeTool } from "./write.js";
import { editTool } from "./edit.js";
import { readTool } from "./read.js";
import { askTool } from "./ask.js";
import { todoTool } from "./todo.js";
import { bashTool } from "./bash.js";
import { globTool } from "./glob.js";
import { grepTool } from "./grep.js";
import { webfetchTool } from "./webfetch.js";
import { listTool } from "./list.js";
import { createFileTool } from "./create_file.js";
import { deleteFileTool } from "./delete_file.js";
import { createDirectoryTool } from "./create_directory.js";
import { deleteDirectoryTool } from "./delete_directory.js";
import { thinkTool } from "./think.js";

export {
  writeTool,
  editTool,
  readTool,
  askTool,
  todoTool,
  bashTool,
  globTool,
  grepTool,
  webfetchTool,
  listTool,
  createFileTool,
  deleteFileTool,
  createDirectoryTool,
  deleteDirectoryTool,
  thinkTool,
};

export { onThought, getThoughts, clearThoughts, type Thought } from "./think.js";

/**
 * Every tool available to the agent.
 *
 * think() is listed first deliberately: models weight earlier tools slightly
 * more heavily, and reasoning before acting is the behaviour we want to bias
 * toward.
 */
export const ALL_TOOLS = [
  thinkTool,
  readTool,
  listTool,
  globTool,
  grepTool,
  writeTool,
  editTool,
  createFileTool,
  createDirectoryTool,
  deleteFileTool,
  deleteDirectoryTool,
  bashTool,
  webfetchTool,
  todoTool,
  askTool,
];

/**
 * Populates the shared tool registry. Safe to call more than once.
 *
 * Previously nothing ever called into the registry, so the tool definitions in
 * this directory were dead code and the chat path hardcoded two inline schemas.
 */
export function registerAllTools(): void {
  registerTools(ALL_TOOLS);
}
