import type { ResolvedProfile } from "@/config/profiles";
import { getAccessToken, refreshAccessToken } from "./auth";
import { SquidexApiError } from "./errors";

export interface SquidexRequest {
  path: string;
  method?: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

export interface SquidexUploadRequest {
  path: string;
  method?: string;
  query?: Record<string, string | number | boolean | undefined>;
  form: FormData;
}

function buildUrl(profile: ResolvedProfile, path: string, query?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(path, profile.url);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function networkError(profile: ResolvedProfile, method: string, path: string, err: unknown): SquidexApiError {
  // status 0 marks a network-level failure — no HTTP response was ever received.
  if (err instanceof Error && err.name === "TimeoutError") {
    return new SquidexApiError(0, undefined, `Squidex request timed out after ${profile.requestTimeoutMs}ms: ${method} ${path}`);
  }
  return new SquidexApiError(
    0,
    undefined,
    `Squidex request failed: ${method} ${path} — ${err instanceof Error ? err.message : String(err)}`,
  );
}

async function performJsonRequest(profile: ResolvedProfile, req: SquidexRequest, token: string): Promise<Response> {
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
    throw networkError(profile, req.method ?? "GET", req.path, err);
  }
}

async function performUploadRequest(profile: ResolvedProfile, req: SquidexUploadRequest, token: string): Promise<Response> {
  try {
    return await fetch(buildUrl(profile, req.path, req.query), {
      method: req.method ?? "POST",
      // No content-type header: fetch sets the multipart boundary itself from the FormData body.
      headers: { authorization: `Bearer ${token}` },
      body: req.form,
      signal: AbortSignal.timeout(profile.requestTimeoutMs),
    });
  } catch (err) {
    throw networkError(profile, req.method ?? "POST", req.path, err);
  }
}

/** Shared by squidexFetch/squidexUpload: retries once on 401, then maps non-2xx responses to SquidexApiError. */
async function withRetry<T>(
  profile: ResolvedProfile,
  method: string,
  path: string,
  perform: (token: string) => Promise<Response>,
): Promise<T> {
  const token = await getAccessToken(profile);
  let response = await perform(token);

  if (response.status === 401) {
    const freshToken = await refreshAccessToken(profile);
    response = await perform(freshToken);
  }

  if (!response.ok) {
    throw new SquidexApiError(response.status, await readBody(response), `Squidex API error ${response.status} on ${method} ${path}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** The one place that adds the auth header, resolves the base URL, retries once on 401, and maps errors. */
export async function squidexFetch<T>(profile: ResolvedProfile, req: SquidexRequest): Promise<T> {
  return withRetry(profile, req.method ?? "GET", req.path, (token) => performJsonRequest(profile, req, token));
}

/** Like squidexFetch, but sends a multipart/form-data body — used for asset uploads. */
export async function squidexUpload<T>(profile: ResolvedProfile, req: SquidexUploadRequest): Promise<T> {
  return withRetry(profile, req.method ?? "POST", req.path, (token) => performUploadRequest(profile, req, token));
}
