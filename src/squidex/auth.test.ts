import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { ResolvedProfile } from "@/config/profiles";
import { __resetTokenCacheForTests, getAccessToken } from "./auth";

const originalFetch = globalThis.fetch;

function profile(overrides: Partial<ResolvedProfile> = {}): ResolvedProfile {
  return {
    name: "prod",
    url: "https://cloud.squidex.io",
    app: "blog",
    clientId: "client-id",
    clientSecret: "client-secret",
    requestTimeoutMs: 15_000,
    ...overrides,
  };
}

function fakeTokenResponse(accessToken: string, expiresInSeconds = 3600): Response {
  return new Response(JSON.stringify({ access_token: accessToken, expires_in: expiresInSeconds }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  __resetTokenCacheForTests();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("getAccessToken", () => {
  test("caches the token across sequential calls for the same profile", async () => {
    let callCount = 0;
    globalThis.fetch = (async () => {
      callCount++;
      return fakeTokenResponse("token-1");
    }) as unknown as typeof fetch;

    const p = profile();
    const first = await getAccessToken(p);
    const second = await getAccessToken(p);

    expect(first).toBe("token-1");
    expect(second).toBe("token-1");
    expect(callCount).toBe(1);
  });

  test("dedupes concurrent calls into a single fetch", async () => {
    let callCount = 0;
    globalThis.fetch = (async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return fakeTokenResponse("token-1");
    }) as unknown as typeof fetch;

    const p = profile();
    const results = await Promise.all([getAccessToken(p), getAccessToken(p), getAccessToken(p)]);

    expect(results).toEqual(["token-1", "token-1", "token-1"]);
    expect(callCount).toBe(1);
  });

  test("refetches once the cached token has expired", async () => {
    let callCount = 0;
    globalThis.fetch = (async () => {
      callCount++;
      return fakeTokenResponse(`token-${callCount}`, callCount === 1 ? -1 : 3600);
    }) as unknown as typeof fetch;

    const p = profile();
    const first = await getAccessToken(p);
    const second = await getAccessToken(p);

    expect(first).toBe("token-1");
    expect(second).toBe("token-2");
    expect(callCount).toBe(2);
  });

  test("does not share a cache entry between different profiles", async () => {
    let callCount = 0;
    globalThis.fetch = (async () => {
      callCount++;
      return fakeTokenResponse(`token-${callCount}`);
    }) as unknown as typeof fetch;

    const a = await getAccessToken(profile({ name: "a", app: "app-a" }));
    const b = await getAccessToken(profile({ name: "b", app: "app-b" }));

    expect(a).not.toBe(b);
    expect(callCount).toBe(2);
  });
});
