import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listProfileNames, resolveProfile } from "@/config/profiles";
import { addField, createSchema, deleteSchema, getSchema, listSchemas, publishSchema, updateField } from "@/squidex/schemas";
import { runTool } from "./run-tool";
import { jsonResult } from "./tool-result";

const profileParam = z.string().optional().describe("Profile name from squidex.config.json; uses the default profile if omitted.");
const schemaNameParam = z.string().describe("Schema name.");
const partitioningParam = z
  .enum(["invariant", "language"])
  .optional()
  .describe('Defaults to "invariant" if omitted. Not applicable to nested fields.');
const fieldPropertiesParam = z
  .record(z.string(), z.unknown())
  .describe(
    'Field properties, shaped per Squidex\'s fieldType discriminator, e.g. { "fieldType": "String", "isRequired": true }. ' +
      "fieldType is one of: String, Number, Boolean, DateTime, Assets, References, Component, Components, Array, Tags, Geolocation, Json, RichText, UI.",
  );
const nestedFieldInputSchema = z.object({
  name: z.string().describe("Nested field name, unique within the parent field."),
  properties: fieldPropertiesParam,
});
const fieldInputSchema = z.object({
  name: z.string().describe("Field name, unique within the schema."),
  partitioning: partitioningParam,
  properties: fieldPropertiesParam,
  nested: z
    .array(nestedFieldInputSchema)
    .optional()
    .describe("Child fields — only valid when this field's properties.fieldType is Array or Component/Components."),
});

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
      description:
        "Get a schema's full field definitions, including each field's id and localization mode — use this before content_create/content_update to shape the data payload correctly, and before schema_add_field/schema_update_field to find parentId/fieldId.",
      inputSchema: { profile: profileParam, name: schemaNameParam },
    },
    ({ profile: profileName, name }) =>
      runTool("schema_get", async () => {
        const profile = await resolveProfile(profileName);
        return jsonResult(await getSchema(profile, name));
      }),
  );

  server.registerTool(
    "schema_create",
    {
      description:
        "Create a new content schema. Squidex creates schemas in Draft by default and content_create/content_update reject drafts — pass isPublished:true, or call schema_publish afterwards.",
      inputSchema: {
        profile: profileParam,
        name: z.string().describe("Schema name — lowercase alphanumeric, hyphen-separated."),
        type: z
          .enum(["Default", "Singleton", "Component"])
          .optional()
          .describe('Defaults to "Default". "Singleton" allows exactly one content item; "Component" makes it usable only as a nested Component field.'),
        isPublished: z.boolean().optional().describe("Publish immediately so content can be created against it right away."),
        category: z.string().optional().describe("UI category/grouping for the schema."),
        properties: z.record(z.string(), z.unknown()).optional().describe('Schema-level UI properties, e.g. { "label": "Blog Posts" }.'),
        fields: z.array(fieldInputSchema).optional().describe("Initial fields — fields can also be added later via schema_add_field."),
      },
    },
    ({ profile: profileName, name, type, isPublished, category, properties, fields }) =>
      runTool("schema_create", async () => {
        const profile = await resolveProfile(profileName);
        return jsonResult(await createSchema(profile, { name, type, isPublished, category, properties, fields }));
      }),
  );

  server.registerTool(
    "schema_add_field",
    {
      description:
        "Add a field to a schema. Set parentId (the parent field's fieldId, from schema_get) to add a nested field under an existing Array/Component field instead of a root field.",
      inputSchema: {
        profile: profileParam,
        name: schemaNameParam,
        fieldName: z.string().describe("New field's name, unique within the schema (or within the parent field, for nested fields)."),
        partitioning: partitioningParam,
        properties: fieldPropertiesParam,
        parentId: z.number().int().optional().describe("Parent field's fieldId — set to add a nested field under an Array/Component field."),
      },
    },
    ({ profile: profileName, name, fieldName, partitioning, properties, parentId }) =>
      runTool("schema_add_field", async () => {
        const profile = await resolveProfile(profileName);
        return jsonResult(await addField(profile, name, { name: fieldName, partitioning, properties, parentId }));
      }),
  );

  server.registerTool(
    "schema_update_field",
    {
      description: "Replace a field's properties. Get the field's fieldId (and parentId, for nested fields) from schema_get.",
      inputSchema: {
        profile: profileParam,
        name: schemaNameParam,
        fieldId: z.number().int().describe("Field id, from schema_get."),
        properties: fieldPropertiesParam,
        parentId: z.number().int().optional().describe("Parent field's fieldId — set when updating a nested field under an Array/Component field."),
      },
    },
    ({ profile: profileName, name, fieldId, properties, parentId }) =>
      runTool("schema_update_field", async () => {
        const profile = await resolveProfile(profileName);
        return jsonResult(await updateField(profile, name, { fieldId, properties, parentId }));
      }),
  );

  server.registerTool(
    "schema_publish",
    {
      description:
        "Publish a schema. Squidex creates schemas in Draft by default and rejects content_create/content_update against an unpublished schema.",
      inputSchema: { profile: profileParam, name: schemaNameParam },
    },
    ({ profile: profileName, name }) =>
      runTool("schema_publish", async () => {
        const profile = await resolveProfile(profileName);
        return jsonResult(await publishSchema(profile, name));
      }),
  );

  server.registerTool(
    "schema_delete",
    {
      description: "Delete a schema — for discarding a failed design iteration. Irreversible; permanent:true also deletes its content instead of soft-deleting.",
      inputSchema: {
        profile: profileParam,
        name: schemaNameParam,
        permanent: z.boolean().optional().describe("Permanently delete the schema and its content instead of a soft delete."),
      },
    },
    ({ profile: profileName, name, permanent }) =>
      runTool("schema_delete", async () => {
        const profile = await resolveProfile(profileName);
        await deleteSchema(profile, name, permanent);
        return jsonResult({ name, deleted: true });
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
