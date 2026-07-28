# squidex-mcp

An MCP (Model Context Protocol) server that exposes Squidex CMS content and schemas as tools for AI agents. MCP is an open, model-agnostic protocol — any compliant client works (Claude Code/Desktop, Cursor, Windsurf, custom agents on any model), not just Anthropic's. Built on [Bun](https://bun.com) for fast, dependency-free startup — each agent session spawns its own server process over stdio.

## Setup

```bash
bun install
cp squidex.config.example.json squidex.config.json
# edit squidex.config.json with your Squidex app(s) — see "Profiles" below
```

## Run

```bash
bun run start        # start the MCP server (stdio transport)
bun run dev           # start with --watch for local development
```

Point your MCP client at `bun run src/index.ts` in this directory (any MCP-compliant client — the config section will differ by client, but the command is the same).

## Profiles

`squidex.config.json` holds one or more named Squidex targets, plus a request timeout shared by all of them:

```jsonc
{
  "defaultProfile": "prod",
  "requestTimeoutMs": 15000,
  "profiles": {
    "prod":    { "url": "https://cloud.squidex.io", "app": "blog",  "clientId": "...", "clientSecret": "..." },
    "staging": { "url": "https://cloud.squidex.io", "app": "blog-s", "clientId": "...", "clientSecret": "..." }
  }
}
```

Every tool accepts an optional `profile` parameter to pick which Squidex app/instance to target — no server restart needed to switch. The file is re-read on every call. `squidex.config.json` is gitignored; commit `squidex.config.example.json` instead.

`requestTimeoutMs` (default 15000) applies to every Squidex HTTP request (content/schema calls and the OAuth token endpoint) — a value here applies uniformly across all profiles, it isn't set per-profile.

If no config file is found, a single implicit `default` profile is built from `SQUIDEX_URL` / `SQUIDEX_APP` / `SQUIDEX_CLIENT_ID` / `SQUIDEX_CLIENT_SECRET` env vars.

## Tools

| Tool | Purpose |
|---|---|
| `schema_list` | List content schemas in the app |
| `schema_get` | Get a schema's fields, including localization mode |
| `content_query` | Query content items (OData-style `filter`/`top`/`skip`/`orderby`/`search`) |
| `content_get` | Get a single content item |
| `content_create` | Create a content item |
| `content_update` | Replace a content item's data |
| `content_delete` | Delete a content item |
| `content_change_status` | Change workflow status (Draft/Published/Archived) |
| `profile_list` | List configured profile names (no secrets) |

Content field data must already be shaped per Squidex's partitioning (`{ "title": { "iv": "..." } }` for invariant fields, `{ "en": "...", "de": "..." }` for localized ones) — call `schema_get` first to see each field's mode.

## Development

```bash
bun test              # unit tests (config, token cache, query builder — no live Squidex needed)
bun run typecheck      # tsc --noEmit
bun run scripts/smoke.ts [--profile <name>]   # manual smoke test against a real Squidex instance
```

### Local Squidex for end-to-end testing

`docker-compose.yml` runs a local Squidex + MongoDB for real (non-mocked) testing:

```bash
docker compose up -d                    # starts Squidex on http://localhost:8085
bun run scripts/e2e-bootstrap.ts        # creates a "mcp-test" app + "posts" schema, writes squidex.config.json
bun run scripts/smoke.ts                # or drive the tools directly via an MCP client
```

`e2e-bootstrap.ts` is idempotent — safe to re-run against an already-bootstrapped instance. It authenticates as the `root` superadmin client (created via `IDENTITY__ADMINCLIENTID`/`IDENTITY__ADMINCLIENTSECRET` in `docker-compose.yml`, dev-only credentials, not real secrets) and writes a `local` profile into `squidex.config.json`.

`docker compose down` stops it; add `-v` to also wipe the Mongo volume (fresh Squidex on next `up`).
