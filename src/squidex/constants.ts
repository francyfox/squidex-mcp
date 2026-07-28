/**
 * Fallback applied to every Squidex HTTP request (content/schema API calls and the OAuth token
 * endpoint) when squidex.config.json doesn't set `requestTimeoutMs` — so an unreachable or hanging
 * instance fails fast instead of blocking a tool call indefinitely.
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
