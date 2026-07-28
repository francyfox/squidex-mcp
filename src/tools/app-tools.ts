import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveProfile } from "@/config/profiles";
import { listLanguages } from "@/squidex/languages";
import { runTool } from "./run-tool";
import { jsonResult } from "./tool-result";

const profileParam = z.string().optional().describe("Profile name from squidex.config.json; uses the default profile if omitted.");

export function registerAppTools(server: McpServer): void {
  server.registerTool(
    "language_list",
    {
      description:
        "List the languages configured for a Squidex app. content_create/content_update must partition localized fields by these iso2Code values (e.g. { \"en\": ..., \"de\": ... }) — call this before writing content with localized fields instead of guessing which languages are configured.",
      inputSchema: { profile: profileParam },
    },
    ({ profile: profileName }) =>
      runTool("language_list", async () => {
        const profile = await resolveProfile(profileName);
        return jsonResult(await listLanguages(profile));
      }),
  );
}
