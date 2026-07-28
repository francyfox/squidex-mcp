#!/usr/bin/env bun
/**
 * Manual smoke test against a real Squidex instance — not part of `bun test`.
 * Usage: bun run scripts/smoke.ts [--profile <name>]
 */
import { resolveProfile } from "@/config/profiles";
import { queryContents } from "@/squidex/content";
import { listSchemas } from "@/squidex/schemas";

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const profile = await resolveProfile(readArg("--profile"));
console.log(`Using profile "${profile.name}" -> ${profile.url} (app: ${profile.app})`);

const schemas = await listSchemas(profile);
console.log(`\nSchemas (${schemas.length}):`);
console.log(schemas.map((s) => `  - ${s.name}`).join("\n"));

const firstSchema = schemas[0];
if (firstSchema) {
  const result = await queryContents(profile, firstSchema.name, { top: 3 });
  console.log(`\nFirst 3 items of "${firstSchema.name}" (total: ${result.total}):`);
  console.log(JSON.stringify(result.items, null, 2));
}
