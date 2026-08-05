import type { ToolDefinition } from "../api/tools.js";

const FETCH_TIMEOUT_MS = 30_000;
const MAX_CONTENT_LENGTH = 10_000;

export const webfetchTool: ToolDefinition = {
  name: "webfetch",
  description:
    "Fetch content from an HTTP or HTTPS URL and return up to 10,000 characters of the text body.",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", description: "HTTP or HTTPS URL to fetch" },
    },
    required: ["url"],
  },
  async execute(args, context) {
    const rawUrl = typeof args.url === "string" ? args.url.trim() : "";
    if (!rawUrl) throw new Error("The `url` parameter is required");

    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Only HTTP and HTTPS URLs are supported");
    }

    const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
    const signal = context.abort
      ? AbortSignal.any([context.abort, timeout])
      : timeout;

    let response: Response;
    try {
      response = await fetch(url, { signal });
    } catch (error) {
      if (context.abort?.aborted) throw new Error("Web fetch aborted");
      if (timeout.aborted) {
        throw new Error(`Web fetch timed out after ${FETCH_TIMEOUT_MS / 1000}s`);
      }
      throw error;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    return text.slice(0, MAX_CONTENT_LENGTH);
  },
};
