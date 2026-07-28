import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "@/logger";
import { toolError } from "./tool-error";

/**
 * Centralizes per-tool-call logging and the error-to-isError boundary: every Squidex/config
 * failure gets logged to stderr AND surfaces to the agent as `isError`, but never throws out of
 * the stdio handler — one bad call should never take down the whole session.
 */
export async function runTool(name: string, fn: () => Promise<CallToolResult>): Promise<CallToolResult> {
  const startedAt = Date.now();
  logger.info("tool_call_start", { tool: name });
  try {
    const result = await fn();
    logger.info("tool_call_end", { tool: name, durationMs: Date.now() - startedAt, isError: result.isError ?? false });
    return result;
  } catch (err) {
    logger.error("tool_call_error", {
      tool: name,
      durationMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    });
    return toolError(err);
  }
}
