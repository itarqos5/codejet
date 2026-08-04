import * as readline from "node:readline";
import type { ToolDefinition } from "../api/tools.js";

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function promptChoice(question: string, options: string[]): Promise<string> {
  console.log(`\n${question}`);
  for (let i = 0; i < options.length; i++) {
    console.log(`  ${i + 1}) ${options[i]}`);
  }
  return prompt("Choice: ").then((answer) => {
    const idx = parseInt(answer, 10);
    if (idx >= 1 && idx <= options.length) return options[idx - 1];
    return answer;
  });
}

export const askTool: ToolDefinition = {
  name: "ask",
  description:
    "Ask the user a question. If options are provided, present them as a numbered list. Otherwise, let the user type freely.",
  parameters: {
    type: "object",
    properties: {
      question: { type: "string", description: "The question to ask the user" },
      options: {
        type: "array",
        items: { type: "string" },
        description: "Optional list of choices to present",
      },
    },
    required: ["question"],
  },
  async execute(args) {
    const question = args.question as string;
    const options = args.options as string[] | undefined;

    if (options && options.length > 0) {
      return promptChoice(question, options);
    }
    return prompt(`${question}: `);
  },
};
