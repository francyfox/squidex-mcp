import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveProfile } from "@/config/profiles";
import {
  changeContentStatus,
  createContent,
  deleteContent,
  getContent,
  queryContents,
  updateContent,
} from "@/squidex/content";
import { runTool } from "./run-tool";
import { jsonResult } from "./tool-result";

const profileParam = z.string().optional().describe("Profile name from squidex.config.json; uses the default profile if omitted.");
const schemaParam = z.string().describe("Squidex schema name.");
const idParam = z.string().describe("Content item id.");
const dataParam = z
  .record(z.string(), z.unknown())
  .describe(
    "Content fields already shaped per Squidex's partitioning: " +
      '{ "fieldName": { "iv": value } } for invariant fields, ' +
      '{ "fieldName": { "en": value, "de": value } } for localized fields. ' +
      "Call schema_get first to see each field's partitioning.",
  );

export function registerContentTools(server: McpServer): void {
  server.registerTool(
    "content_query",
    {
      description: "Query content items of a schema using OData-style parameters.",
      inputSchema: {
        profile: profileParam,
        schema: schemaParam,
        filter: z.string().optional().describe("OData $filter expression."),
        top: z.number().int().positive().optional().describe("Max items to return."),
        skip: z.number().int().nonnegative().optional().describe("Items to skip, for pagination."),
        orderby: z.string().optional().describe("OData $orderby expression."),
        search: z.string().optional().describe("Full-text search term."),
      },
    },
    ({ profile: profileName, schema, filter, top, skip, orderby, search }) =>
      runTool("content_query", async () => {
        const profile = await resolveProfile(profileName);
        const result = await queryContents(profile, schema, { filter, top, skip, orderby, search });
        return jsonResult(result);
      }),
  );

  server.registerTool(
    "content_get",
    {
      description: "Get a single content item by id.",
      inputSchema: { profile: profileParam, schema: schemaParam, id: idParam },
    },
    ({ profile: profileName, schema, id }) =>
      runTool("content_get", async () => {
        const profile = await resolveProfile(profileName);
        return jsonResult(await getContent(profile, schema, id));
      }),
  );

  server.registerTool(
    "content_create",
    {
      description: "Create a new content item.",
      inputSchema: {
        profile: profileParam,
        schema: schemaParam,
        data: dataParam,
        publish: z.boolean().optional().describe("Publish immediately instead of leaving it as Draft."),
      },
    },
    ({ profile: profileName, schema, data, publish }) =>
      runTool("content_create", async () => {
        const profile = await resolveProfile(profileName);
        return jsonResult(await createContent(profile, schema, data, publish));
      }),
  );

  server.registerTool(
    "content_update",
    {
      description: "Replace a content item's field data.",
      inputSchema: { profile: profileParam, schema: schemaParam, id: idParam, data: dataParam },
    },
    ({ profile: profileName, schema, id, data }) =>
      runTool("content_update", async () => {
        const profile = await resolveProfile(profileName);
        return jsonResult(await updateContent(profile, schema, id, data));
      }),
  );

  server.registerTool(
    "content_delete",
    {
      description: "Delete a content item.",
      inputSchema: { profile: profileParam, schema: schemaParam, id: idParam },
    },
    ({ profile: profileName, schema, id }) =>
      runTool("content_delete", async () => {
        const profile = await resolveProfile(profileName);
        await deleteContent(profile, schema, id);
        return jsonResult({ id, deleted: true });
      }),
  );

  server.registerTool(
    "content_change_status",
    {
      description: "Change a content item's workflow status (e.g. publish or archive it).",
      inputSchema: {
        profile: profileParam,
        schema: schemaParam,
        id: idParam,
        status: z.enum(["Draft", "Published", "Archived"]),
      },
    },
    ({ profile: profileName, schema, id, status }) =>
      runTool("content_change_status", async () => {
        const profile = await resolveProfile(profileName);
        return jsonResult(await changeContentStatus(profile, schema, id, status));
      }),
  );
}
