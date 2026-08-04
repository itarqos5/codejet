import { exec } from "node:child_process";
import type { ToolDefinition } from "../api/tools.js";

export const bashTool: ToolDefinition = {
  name: "bash",
  description: "Execute a shell command and return its output.",
  parameters: {
    type: "object",
    properties: {
      command: { type: "string", description: "Shell command to execute" },
    },
    required: ["command"],
  },
  async execute(args, context) {
    const command = args.command as string;
    const cwd = context.directory ?? process.cwd();

    return new Promise((resolve) => {
      exec(command, { cwd, maxBuffer: 1024 * 1024, timeout: 30_000 }, (error, stdout, stderr) => {
        const parts: string[] = [];
        if (stdout) parts.push(stdout);
        if (stderr) parts.push(`[stderr] ${stderr}`);
        if (error && !stdout && !stderr) parts.push(`Error: ${error.message}`);
        resolve(parts.join("\n") || "(no output)");
      });
    });
  },
};
