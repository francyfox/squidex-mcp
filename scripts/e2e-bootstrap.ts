#!/usr/bin/env bun
/**
 * One-time local bootstrap for the docker-compose Squidex instance: creates a test app + schema
 * and writes squidex.config.json pointing at it. Safe to re-run — skips steps that already exist.
 * Usage: docker compose up -d && bun run scripts/e2e-bootstrap.ts
 */
import { writeFile } from "node:fs/promises";

const BASE_URL = process.env.SQUIDEX_LOCAL_URL ?? "http://localhost:8085";
const APP_NAME = "mcp-test";
const SCHEMA_NAME = "posts";
const ROOT_CLIENT_ID = "root";
// Matches IDENTITY__ADMINCLIENTSECRET in docker-compose.yml — local dev only, not a real secret.
const ROOT_CLIENT_SECRET = "SquidexRootSecret123!";

async function waitForSquidex(): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/api`);
      if (res.status === 401 || res.ok) return; // 401 = up, just unauthenticated
    } catch {
      // not reachable yet
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Squidex at ${BASE_URL} did not become ready in time`);
}

async function getRootToken(): Promise<string> {
  const res = await fetch(`${BASE_URL}/identity-server/connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: ROOT_CLIENT_ID,
      client_secret: ROOT_CLIENT_SECRET,
      scope: "squidex-api",
    }),
  });
  if (!res.ok) throw new Error(`Failed to get root token: HTTP ${res.status} — ${await res.text()}`);
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

async function ensureApp(token: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/apps`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ name: APP_NAME }),
  });
  if (res.ok || res.status === 400) return; // 400 covers "app already exists"
  throw new Error(`Failed to create app: HTTP ${res.status} — ${await res.text()}`);
}

async function ensureSchema(token: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/apps/${APP_NAME}/schemas`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      name: SCHEMA_NAME,
      fields: [{ name: "title", properties: { fieldType: "String", isRequired: true } }],
      isPublished: true,
    }),
  });
  if (res.ok || res.status === 400) return; // 400 covers "schema already exists"
  throw new Error(`Failed to create schema: HTTP ${res.status} — ${await res.text()}`);
}

async function writeLocalConfig(): Promise<void> {
  const config = {
    defaultProfile: "local",
    requestTimeoutMs: 15000,
    profiles: {
      local: { url: BASE_URL, app: APP_NAME, clientId: ROOT_CLIENT_ID, clientSecret: ROOT_CLIENT_SECRET },
    },
  };
  await writeFile("squidex.config.json", `${JSON.stringify(config, null, 2)}\n`);
}

console.log(`Waiting for Squidex at ${BASE_URL}...`);
await waitForSquidex();
console.log("Squidex is up. Authenticating as root...");
const token = await getRootToken();
console.log(`Ensuring app "${APP_NAME}"...`);
await ensureApp(token);
console.log(`Ensuring schema "${SCHEMA_NAME}"...`);
await ensureSchema(token);
await writeLocalConfig();
console.log(`Wrote squidex.config.json with profile "local" -> ${BASE_URL}`);
