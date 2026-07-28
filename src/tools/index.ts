import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerContentTools } from "./content-tools";
import { registerSchemaTools } from "./schema-tools";

export function registerAllTools(server: McpServer): void {
  registerSchemaTools(server);
  registerContentTools(server);
}
