import type { ToolDefinition } from "../api/tools.js";

export const webfetchTool: ToolDefinition = {
  name: "webfetch",
  description: "Fetch content from a URL and return the text body.",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", description: "URL to fetch" },
    },
    required: ["url"],
  },
  async execute(args) {
    const url = args.url as string;
    const res = await fetch(url);
    if (!res.ok) {
      return `Error: HTTP ${res.status} ${res.statusText}`;
    }
    const text = await res.text();
    return text.slice(0, 10_000);
  },
};
