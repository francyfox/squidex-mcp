import type { ResolvedProfile } from "@/config/profiles";
import { squidexFetch } from "./http";

export interface SchemaSummary {
  id: string;
  name: string;
  type: string;
}

export interface SchemaField {
  /** Numeric field id — pass this as `fieldId` (and the parent's as `parentId` for nested fields) to schema_update_field. */
  fieldId: number;
  name: string;
  properties: Record<string, unknown>;
  /** "invariant" fields use the "iv" key in content data; "language" fields use per-language keys (e.g. "en", "de"). */
  partitioning: "invariant" | "language";
  /** Present on Array/Component fields — their child fields, addressed via schema_add_field/schema_update_field's `parentId`. */
  nested?: SchemaField[];
}

export interface SchemaDetails extends SchemaSummary {
  fields: SchemaField[];
}

// NOTE: assumed response shape `{ items: [...] }`, matching Squidex's other list endpoints —
// verify against the target instance's /api/swagger.json during the manual smoke test.
export async function listSchemas(profile: ResolvedProfile): Promise<SchemaSummary[]> {
  const result = await squidexFetch<{ items: SchemaSummary[] }>(profile, {
    path: `/api/apps/${profile.app}/schemas`,
  });
  return result.items;
}

export async function getSchema(profile: ResolvedProfile, name: string): Promise<SchemaDetails> {
  return squidexFetch<SchemaDetails>(profile, { path: `/api/apps/${profile.app}/schemas/${name}` });
}

export interface NestedFieldInput {
  name: string;
  /** e.g. { fieldType: "String", isRequired: true } — see Squidex's field property docs for the shape per fieldType. */
  properties: Record<string, unknown>;
}

export interface SchemaFieldInput extends NestedFieldInput {
  partitioning?: "invariant" | "language";
  /** Only valid when `properties.fieldType` is "Array" or "Component"/"Components". */
  nested?: NestedFieldInput[];
}

export interface CreateSchemaParams {
  name: string;
  type?: "Default" | "Singleton" | "Component";
  /** Squidex creates schemas in Draft by default; content_create/content_update reject drafts — set this or call schema_publish before writing content. */
  isPublished?: boolean;
  category?: string;
  properties?: Record<string, unknown>;
  fields?: SchemaFieldInput[];
}

export async function createSchema(profile: ResolvedProfile, params: CreateSchemaParams): Promise<SchemaDetails> {
  return squidexFetch<SchemaDetails>(profile, {
    path: `/api/apps/${profile.app}/schemas`,
    method: "POST",
    body: params,
  });
}

export interface AddFieldParams {
  name: string;
  partitioning?: "invariant" | "language";
  properties: Record<string, unknown>;
  /** Parent field id — set this to add a nested field under an Array/Component field. */
  parentId?: number;
}

export async function addField(profile: ResolvedProfile, schemaName: string, params: AddFieldParams): Promise<SchemaDetails> {
  const base = `/api/apps/${profile.app}/schemas/${schemaName}/fields`;
  const path = params.parentId !== undefined ? `${base}/${params.parentId}/nested` : base;
  return squidexFetch<SchemaDetails>(profile, {
    path,
    method: "POST",
    body: { name: params.name, partitioning: params.partitioning, properties: params.properties },
  });
}

export interface UpdateFieldParams {
  fieldId: number;
  properties: Record<string, unknown>;
  /** Parent field id — set this when updating a nested field under an Array/Component field. */
  parentId?: number;
}

export async function updateField(profile: ResolvedProfile, schemaName: string, params: UpdateFieldParams): Promise<SchemaDetails> {
  const base = `/api/apps/${profile.app}/schemas/${schemaName}/fields`;
  const path = params.parentId !== undefined ? `${base}/${params.parentId}/nested/${params.fieldId}` : `${base}/${params.fieldId}`;
  return squidexFetch<SchemaDetails>(profile, {
    path,
    method: "PUT",
    body: { properties: params.properties },
  });
}

export async function publishSchema(profile: ResolvedProfile, name: string): Promise<SchemaDetails> {
  return squidexFetch<SchemaDetails>(profile, { path: `/api/apps/${profile.app}/schemas/${name}/publish`, method: "PUT" });
}

export async function deleteSchema(profile: ResolvedProfile, name: string, permanent = false): Promise<void> {
  await squidexFetch<void>(profile, {
    path: `/api/apps/${profile.app}/schemas/${name}`,
    method: "DELETE",
    query: { permanent },
  });
}
