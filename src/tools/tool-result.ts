import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/** Wraps a JSON-serializable value as a successful MCP tool result. */
export function jsonResult(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}
