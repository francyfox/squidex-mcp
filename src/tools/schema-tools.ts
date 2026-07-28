import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listProfileNames, resolveProfile } from "@/config/profiles";
import { getSchema, listSchemas } from "@/squidex/schemas";
import { runTool } from "./run-tool";
import { jsonResult } from "./tool-result";

const profileParam = z.string().optional().describe("Profile name from squidex.config.json; uses the default profile if omitted.");

export function registerSchemaTools(server: McpServer): void {
  server.registerTool(
    "schema_list",
    {
      description: "List content schemas available in a Squidex app.",
      inputSchema: { profile: profileParam },
    },
    ({ profile: profileName }) =>
      runTool("schema_list", async () => {
        const profile = await resolveProfile(profileName);
        return jsonResult(await listSchemas(profile));
      }),
  );

  server.registerTool(
    "schema_get",
    {
      description: "Get a schema's full field definitions, including each field's localization mode — use this before content_create/content_update to shape the data payload correctly.",
      inputSchema: { profile: profileParam, name: z.string().describe("Schema name.") },
    },
    ({ profile: profileName, name }) =>
      runTool("schema_get", async () => {
        const profile = await resolveProfile(profileName);
        return jsonResult(await getSchema(profile, name));
      }),
  );

  server.registerTool(
    "profile_list",
    {
      description: "List configured Squidex profile names (never secrets), so an agent can discover which instances are available.",
      inputSchema: {},
    },
    () => runTool("profile_list", async () => jsonResult(await listProfileNames())),
  );
}
