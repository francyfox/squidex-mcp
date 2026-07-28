import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTools } from "./app-tools";
import { registerAssetTools } from "./asset-tools";
import { registerContentTools } from "./content-tools";
import { registerSchemaTools } from "./schema-tools";

export function registerAllTools(server: McpServer): void {
  registerSchemaTools(server);
  registerContentTools(server);
  registerAssetTools(server);
  registerAppTools(server);
}
