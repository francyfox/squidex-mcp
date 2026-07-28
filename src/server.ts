import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "@/tools/index";

/** Constructs and wires the server, without touching stdio — importable directly from tests. */
export function createServer(): McpServer {
  const server = new McpServer({ name: "squidex-mcp", version: "0.1.0" });
  registerAllTools(server);
  return server;
}
