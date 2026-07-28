import type { ResolvedProfile } from "@/config/profiles";
import { SquidexApiError } from "./errors";

interface TokenEntry {
  accessToken: string;
  expiresAt: number;
  fingerprint: string;
}

/** Refresh a bit before actual expiry so an in-flight content request never races token expiry. */
const SAFETY_MARGIN_MS = 30_000;

const tokenCache = new Map<string, TokenEntry>();
const inFlight = new Map<string, Promise<TokenEntry>>();

function fingerprintOf(profile: ResolvedProfile): string {
  return `${profile.url}|${profile.app}|${profile.clientId}|${profile.clientSecret}`;
}

async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function fetchToken(profile: ResolvedProfile): Promise<TokenEntry> {
  let response: Response;
  try {
    response = await fetch(`${profile.url}/identity-server/connect/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: profile.clientId,
        client_secret: profile.clientSecret,
        scope: "squidex-api",
      }),
      signal: AbortSignal.timeout(profile.requestTimeoutMs),
    });
  } catch (err) {
    const reason =
      err instanceof Error && err.name === "TimeoutError"
        ? `timed out after ${profile.requestTimeoutMs}ms`
        : `${err instanceof Error ? err.message : String(err)}`;
    throw new SquidexApiError(0, undefined, `Failed to reach Squidex token endpoint for profile "${profile.name}" — ${reason}`);
  }

  if (!response.ok) {
    throw new SquidexApiError(
      response.status,
      await readBody(response),
      `Failed to obtain access token for profile "${profile.name}" (HTTP ${response.status})`,
    );
  }

  const json = (await response.json()) as { access_token: string; expires_in: number };
  return {
    accessToken: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
    fingerprint: fingerprintOf(profile),
  };
}

/**
 * Returns a cached access token for this profile, fetching a new one if missing, expired, or if
 * squidex.config.json changed since it was cached (detected via fingerprint, not just expiry).
 * Concurrent calls for the same profile share one in-flight fetch instead of racing separate requests.
 */
export async function getAccessToken(profile: ResolvedProfile): Promise<string> {
  const key = profile.name;
  const fingerprint = fingerprintOf(profile);
  const cached = tokenCache.get(key);
  if (cached && cached.fingerprint === fingerprint && cached.expiresAt > Date.now() + SAFETY_MARGIN_MS) {
    return cached.accessToken;
  }

  let pending = inFlight.get(key);
  if (!pending) {
    pending = fetchToken(profile).finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }

  const entry = await pending;
  tokenCache.set(key, entry);
  return entry.accessToken;
}

/** Bypasses the cache and forces a fresh token — used for the single 401-triggered retry in http.ts. */
export async function refreshAccessToken(profile: ResolvedProfile): Promise<string> {
  tokenCache.delete(profile.name);
  inFlight.delete(profile.name);
  return getAccessToken(profile);
}

/** Test-only: clears module-level cache state between test cases. */
export function __resetTokenCacheForTests(): void {
  tokenCache.clear();
  inFlight.clear();
}
