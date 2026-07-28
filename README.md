# squidex-mcp (non-official)

[![CI](https://github.com/francyfox/squidex-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/francyfox/squidex-mcp/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/francyfox/squidex-mcp)](https://github.com/francyfox/squidex-mcp/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An MCP (Model Context Protocol) server that lets AI agents read and write [Squidex](https://squidex.io) CMS content directly. MCP is an open, model-agnostic protocol — any compliant client works (Claude Code, Claude Desktop, Cursor, Windsurf, custom agents on any model), not just Anthropic's. Built on [Bun](https://bun.com) for fast, dependency-free startup — each agent session spawns its own server process over stdio.

## What it can do

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
| `profile_list` | List configured Squidex profiles (no secrets) |

It can target multiple Squidex apps/instances (e.g. prod + staging) from one running server — every tool takes an optional `profile` parameter, switchable without restarting the server. See [Profiles](#profiles-multiple-squidex-instances) below.

## Quick start (no coding required)

The easiest way to run it is via `npx` — no download, no build step, just a Node.js install (which most machines already have).

### 1. Get your Squidex credentials

In your Squidex app: **Settings → Clients** → create (or copy) a client. You need:
- your Squidex URL (e.g. `https://cloud.squidex.io`)
- your app name
- the client ID (looks like `your-app-name:default`)
- the client secret

### 2. Register the server with your MCP client

**Claude Code:**

```bash
claude mcp add \
  --env SQUIDEX_URL=https://cloud.squidex.io \
  --env SQUIDEX_APP=your-app-name \
  --env SQUIDEX_CLIENT_ID=your-app-name:default \
  --env SQUIDEX_CLIENT_SECRET=your-client-secret \
  --transport stdio squidex \
  --scope user \
  -- npx -y squidex-mcp
```

`--scope user` makes it available in every project, not just the current one. `-y` stops `npx` from pausing on an interactive "ok to install?" prompt, which would otherwise hang the connection on first run.

**Claude Desktop:** edit *Claude Desktop's own* config file for your OS (this is Claude Desktop's launcher config, not `squidex.config.json` from [Profiles](#profiles-multiple-squidex-instances) below — the `env` block here just sets environment variables for the process Claude Desktop spawns) —
macOS: `~/Library/Application Support/Claude/claude_desktop_config.json` ·
Windows: `%APPDATA%\Claude\claude_desktop_config.json` ·
Linux: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "squidex": {
      "command": "npx",
      "args": ["-y", "squidex-mcp"],
      "env": {
        "SQUIDEX_URL": "https://cloud.squidex.io",
        "SQUIDEX_APP": "your-app-name",
        "SQUIDEX_CLIENT_ID": "your-app-name:default",
        "SQUIDEX_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

Restart the client after editing.

### 3. Try it

Ask your assistant something like *"List the content schemas in my Squidex app"*. If it replies with your schemas, it's working.

### Alternative: standalone binary (no Node.js needed)

If Node.js/npx isn't available, download a prebuilt binary from the [Releases page](https://github.com/francyfox/squidex-mcp/releases/latest) instead:

| OS | File |
|---|---|
| Linux (x64) | `squidex-mcp-linux-x64` |
| Linux (ARM64) | `squidex-mcp-linux-arm64` |
| macOS (Intel) | `squidex-mcp-darwin-x64` |
| macOS (Apple Silicon) | `squidex-mcp-darwin-arm64` |
| Windows (x64) | `squidex-mcp-windows-x64.exe` |

Make it executable on macOS/Linux (`chmod +x ~/Downloads/squidex-mcp-<your-platform>`; macOS may also require `xattr -d com.apple.quarantine <file>` since it isn't notarized), then use its absolute path as `command` instead of `npx` in the config above (and drop the `args`/`-y` bits, which are npx-specific).

## Profiles (multiple Squidex instances)

If you need more than one Squidex app/instance (e.g. prod + staging) reachable from the same server, use a `squidex.config.json` file instead of env vars:

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

Every tool accepts an optional `profile` parameter to pick which target to use — no server restart needed to switch. The file is re-read on every call. `requestTimeoutMs` (default 15000) applies to every Squidex HTTP request across all profiles.

By default the server looks for `squidex.config.json` in its current working directory; point it elsewhere with the `SQUIDEX_MCP_CONFIG` env var (absolute path recommended, since the client process's working directory isn't always predictable). If no config file is found at all, the four `SQUIDEX_*` env vars from Quick start are used as a single implicit `default` profile.

Content field data must already be shaped per Squidex's partitioning (`{ "title": { "iv": "..." } }` for invariant fields, `{ "en": "...", "de": "..." }` for localized ones) — call `schema_get` first to see each field's mode.

## Development

```bash
bun install
bun test               # unit tests (config, token cache, query builder — no live Squidex needed)
bun run typecheck       # tsc --noEmit
bun run dev             # start the server with --watch, for local development
```

Point your MCP client at `bun run src/index.ts` in this directory instead of a downloaded binary while developing.

`bun run build` produces the Node-targeted `dist/index.js` that gets published to npm (dependencies stay external — installed normally via npm/npx, not bundled). Separately, `bun run build:binary` compiles a standalone binary for your current OS only (`dist/squidex-mcp`); `bun run build:binary:all` cross-compiles all five release targets at once (`dist/squidex-mcp-<platform>`) — the same command [`release.yml`](.github/workflows/release.yml) runs when a tag is pushed.

### Local Squidex for end-to-end testing

`docker-compose.yml` runs a local Squidex + MongoDB for real (non-mocked) testing:

```bash
docker compose up -d                    # starts Squidex on http://localhost:8085
bun run scripts/e2e-bootstrap.ts        # creates a "mcp-test" app + "posts" schema, writes squidex.config.json
bun run scripts/smoke.ts                # or drive the tools directly via an MCP client
```

`e2e-bootstrap.ts` is idempotent — safe to re-run against an already-bootstrapped instance. It authenticates as the `root` superadmin client (created via `IDENTITY__ADMINCLIENTID`/`IDENTITY__ADMINCLIENTSECRET` in `docker-compose.yml`, dev-only credentials, not real secrets) and writes a `local` profile into `squidex.config.json`.

`docker compose down` stops it; add `-v` to also wipe the Mongo volume (fresh Squidex on next `up`).

### Releasing

Pushing a tag matching `v*.*.*` triggers [`.github/workflows/release.yml`](.github/workflows/release.yml): it runs the test suite, publishes the package to npm, cross-compiles standalone binaries for Linux/macOS/Windows, and attaches them to a GitHub Release.

```bash
git tag v0.2.0
git push origin v0.2.0
```

Publishing to npm requires an `NPM_TOKEN` repository secret (an npm "Automation" token from [npmjs.com](https://www.npmjs.com) → Access Tokens) under **Settings → Secrets and variables → Actions** — the workflow will fail at the publish step without it.