import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ConfigError, SquidexApiError } from "@/squidex/errors";

function describeBody(body: unknown): string {
  if (body === undefined) return "";
  return ` — ${typeof body === "string" ? body : JSON.stringify(body)}`;
}

/**
 * Maps any error thrown inside a tool handler to an MCP `isError` result instead of letting it
 * crash the stdio session — a bad profile name or an expired token should be something the calling
 * agent can read and react to, not a dead connection.
 */
export function toolError(err: unknown): CallToolResult {
  const message =
    err instanceof SquidexApiError
      ? err.status === 0
        ? err.message // network-level failure (unreachable/timeout) — message already has full context
        : `Squidex API error (${err.status})${describeBody(err.body)}`
      : err instanceof ConfigError
        ? `Configuration error: ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err);

  return { content: [{ type: "text", text: message }], isError: true };
}
