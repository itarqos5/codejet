import type { ToolDefinition } from "../api/tools.js";

/**
 * The think() tool.
 *
 * A scratchpad: it performs no side effects and returns no data. Its purpose is
 * to give the model a place to reason explicitly before acting, and to give the
 * UI something concrete to display while that reasoning happens — the model
 * calling think() is what drives the "Thinking" indicator and the thought
 * transcript.
 *
 * Because the call is observable, reasoning that would otherwise be invisible
 * (or buried in the final answer) becomes something the user can watch and
 * audit.
 */

export interface Thought {
  thought: string;
  nextStep?: string;
  timestamp: number;
}

type ThoughtListener = (thought: Thought) => void;

const listeners = new Set<ThoughtListener>();
const thoughts: Thought[] = [];
const MAX_THOUGHTS = 200;

/**
 * Subscribe to think() calls. Returns an unsubscribe function.
 * Used by the TUI to stream reasoning into the Thinking indicator.
 */
export function onThought(listener: ThoughtListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getThoughts(): readonly Thought[] {
  return thoughts;
}

export function clearThoughts(): void {
  thoughts.length = 0;
}

export function recordThought(thought: Thought): void {
  thoughts.push(thought);
  if (thoughts.length > MAX_THOUGHTS) thoughts.shift();
  for (const listener of listeners) {
    try {
      listener(thought);
    } catch {
      // A misbehaving listener must never break tool execution.
    }
  }
}

export const thinkTool: ToolDefinition = {
  name: "think",
  description: [
    "Think through a problem step by step before acting. Use this to plan, to weigh options,",
    "to work out edge cases, or to check an assumption. It has no side effects and returns no",
    "information — it exists purely so you can reason explicitly.",
    "",
    "Call think() before any non-trivial action: before editing code, after reading a file that",
    "changes your understanding, when a tool result is surprising, and before giving a final",
    "answer to a non-obvious question. Prefer several short focused thoughts over one long one.",
  ].join(" "),
  parameters: {
    type: "object",
    properties: {
      thought: {
        type: "string",
        description:
          "Your reasoning. Be concrete and specific: what you know, what you are unsure about, and why you are choosing a particular approach.",
      },
      next_step: {
        type: "string",
        description: "Optional. The single concrete action you intend to take next.",
      },
    },
    required: ["thought"],
  },
  async execute(args) {
    const thought = typeof args.thought === "string" ? args.thought.trim() : "";
    const nextStep = typeof args.next_step === "string" ? args.next_step.trim() : undefined;

    if (!thought) {
      return "No thought recorded — the `thought` parameter was empty. Provide your reasoning as a string.";
    }

    recordThought({ thought, nextStep, timestamp: Date.now() });

    // The return value is intentionally minimal: think() must not become a
    // channel for smuggling state, and a short ack keeps token cost near zero.
    return nextStep
      ? "Thought recorded. Proceed with the next step."
      : "Thought recorded. Continue.";
  },
};
