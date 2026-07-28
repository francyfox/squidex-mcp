import type { ResolvedProfile } from "@/config/profiles";
import { squidexFetch } from "./http";

export interface SchemaSummary {
  id: string;
  name: string;
  type: string;
}

export interface SchemaField {
  name: string;
  properties: Record<string, unknown>;
  /** "invariant" fields use the "iv" key in content data; "language" fields use per-language keys (e.g. "en", "de"). */
  partitioning: "invariant" | "language";
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
