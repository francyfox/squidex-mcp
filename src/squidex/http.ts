import type { ResolvedProfile } from "@/config/profiles";
import { getAccessToken, refreshAccessToken } from "./auth";
import { SquidexApiError } from "./errors";

export interface SquidexRequest {
  path: string;
  method?: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

function buildUrl(profile: ResolvedProfile, path: string, query?: SquidexRequest["query"]): string {
  const url = new URL(path, profile.url);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function performRequest(profile: ResolvedProfile, req: SquidexRequest, token: string): Promise<Response> {
  try {
    return await fetch(buildUrl(profile, req.path, req.query), {
      method: req.method ?? "GET",
      headers: {
        authorization: `Bearer ${token}`,
        ...(req.body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
      signal: AbortSignal.timeout(profile.requestTimeoutMs),
    });
  } catch (err) {
    // status 0 marks a network-level failure — no HTTP response was ever received.
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new SquidexApiError(
        0,
        undefined,
        `Squidex request timed out after ${profile.requestTimeoutMs}ms: ${req.method ?? "GET"} ${req.path}`,
      );
    }
    throw new SquidexApiError(
      0,
      undefined,
      `Squidex request failed: ${req.method ?? "GET"} ${req.path} — ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/** The one place that adds the auth header, resolves the base URL, retries once on 401, and maps errors. */
export async function squidexFetch<T>(profile: ResolvedProfile, req: SquidexRequest): Promise<T> {
  const token = await getAccessToken(profile);
  let response = await performRequest(profile, req, token);

  if (response.status === 401) {
    const freshToken = await refreshAccessToken(profile);
    response = await performRequest(profile, req, freshToken);
  }

  if (!response.ok) {
    throw new SquidexApiError(
      response.status,
      await readBody(response),
      `Squidex API error ${response.status} on ${req.method ?? "GET"} ${req.path}`,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
