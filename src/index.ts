#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { logger } from "@/logger";
import { createServer } from "@/server";

// Safety net for bugs outside the tool-call boundary (runTool already isolates those) — log the
// reason before exiting instead of dying silently with nothing in stderr to debug from.
process.on("uncaughtException", (err) => {
  logger.error("uncaught_exception", { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("unhandled_rejection", { error: reason instanceof Error ? reason.message : String(reason) });
  process.exit(1);
});

async function main(): Promise<void> {
  logger.info("server_starting", { name: "squidex-mcp", version: "0.1.0" });
  await createServer().connect(new StdioServerTransport());
  logger.info("server_connected");
}

main().catch((err) => {
  logger.error("server_start_failed", { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
