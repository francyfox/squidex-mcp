export type LogLevel = "info" | "warn" | "error";

/**
 * Writes structured JSON lines to stderr — never stdout, since stdout carries the MCP JSON-RPC
 * stream over the stdio transport and any stray output there would corrupt the protocol.
 */
function write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  process.stderr.write(`${JSON.stringify({ time: new Date().toISOString(), level, message, ...meta })}\n`);
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => write("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write("error", message, meta),
};
