import { exec } from "node:child_process";
import type { ToolDefinition } from "../api/tools.js";

export const bashTool: ToolDefinition = {
  name: "bash",
  description:
    "Execute a shell command in the agent workspace and return its output. Non-zero exits are reported as tool errors.",
  parameters: {
    type: "object",
    properties: {
      command: { type: "string", description: "Shell command to execute" },
    },
    required: ["command"],
  },
  async execute(args, context) {
    const command =
      typeof args.command === "string" ? args.command.trim() : "";
    if (!command) throw new Error("The `command` parameter is required");

    const cwd = context.directory ?? process.cwd();

    return new Promise((resolve, reject) => {
      exec(
        command,
        {
          cwd,
          maxBuffer: 1024 * 1024,
          timeout: 30_000,
          signal: context.abort,
        },
        (error, stdout, stderr) => {
          const output = [stdout, stderr ? `[stderr] ${stderr}` : ""]
            .filter(Boolean)
            .join("\n")
            .trimEnd();

          if (error) {
            if (context.abort?.aborted) {
              reject(new Error("Command aborted"));
              return;
            }
            reject(
              new Error(
                output
                  ? `Command failed: ${output}`
                  : `Command failed: ${error.message}`,
              ),
            );
            return;
          }

          resolve(output || "(no output)");
        },
      );
    });
  },
};
