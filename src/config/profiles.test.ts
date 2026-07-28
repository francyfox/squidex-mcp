import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_REQUEST_TIMEOUT_MS } from "@/squidex/constants";
import { ConfigError } from "@/squidex/errors";
import { listProfileNames, resolveProfile } from "./profiles";

async function withConfigFile(content: string, fn: (path: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "squidex-mcp-test-"));
  const path = join(dir, "squidex.config.json");
  await writeFile(path, content);
  try {
    await fn(path);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const validConfig = JSON.stringify({
  defaultProfile: "prod",
  profiles: {
    prod: { url: "https://cloud.squidex.io", app: "blog", clientId: "id-1", clientSecret: "secret-1" },
    staging: { url: "https://cloud.squidex.io", app: "blog-staging", clientId: "id-2", clientSecret: "secret-2" },
  },
});

describe("resolveProfile", () => {
  test("uses defaultProfile when no name given", async () => {
    await withConfigFile(validConfig, async (configPath) => {
      const profile = await resolveProfile(undefined, { configPath });
      expect(profile.name).toBe("prod");
      expect(profile.app).toBe("blog");
    });
  });

  test("resolves an explicitly named profile", async () => {
    await withConfigFile(validConfig, async (configPath) => {
      const profile = await resolveProfile("staging", { configPath });
      expect(profile.name).toBe("staging");
      expect(profile.app).toBe("blog-staging");
    });
  });

  test("defaults requestTimeoutMs when the config file doesn't set it", async () => {
    await withConfigFile(validConfig, async (configPath) => {
      const profile = await resolveProfile(undefined, { configPath });
      expect(profile.requestTimeoutMs).toBe(DEFAULT_REQUEST_TIMEOUT_MS);
    });
  });

  test("applies requestTimeoutMs from the config file to every profile", async () => {
    const config = JSON.stringify({
      defaultProfile: "prod",
      requestTimeoutMs: 5_000,
      profiles: {
        prod: { url: "https://cloud.squidex.io", app: "blog", clientId: "id-1", clientSecret: "secret-1" },
        staging: { url: "https://cloud.squidex.io", app: "blog-staging", clientId: "id-2", clientSecret: "secret-2" },
      },
    });
    await withConfigFile(config, async (configPath) => {
      const prod = await resolveProfile("prod", { configPath });
      const staging = await resolveProfile("staging", { configPath });
      expect(prod.requestTimeoutMs).toBe(5_000);
      expect(staging.requestTimeoutMs).toBe(5_000);
    });
  });

  test("throws ConfigError for an unknown profile name", async () => {
    await withConfigFile(validConfig, async (configPath) => {
      await expect(resolveProfile("nonexistent", { configPath })).rejects.toThrow(ConfigError);
    });
  });

  test("throws ConfigError for malformed JSON", async () => {
    await withConfigFile("{ not valid json", async (configPath) => {
      await expect(resolveProfile(undefined, { configPath })).rejects.toThrow(ConfigError);
    });
  });

  test("throws ConfigError when no defaultProfile and multiple profiles exist", async () => {
    const config = JSON.stringify({
      profiles: {
        a: { url: "https://cloud.squidex.io", app: "a", clientId: "id", clientSecret: "secret" },
        b: { url: "https://cloud.squidex.io", app: "b", clientId: "id", clientSecret: "secret" },
      },
    });
    await withConfigFile(config, async (configPath) => {
      await expect(resolveProfile(undefined, { configPath })).rejects.toThrow(ConfigError);
    });
  });

  test("falls back to the single profile when there is exactly one and no defaultProfile", async () => {
    const config = JSON.stringify({
      profiles: {
        solo: { url: "https://cloud.squidex.io", app: "solo-app", clientId: "id", clientSecret: "secret" },
      },
    });
    await withConfigFile(config, async (configPath) => {
      const profile = await resolveProfile(undefined, { configPath });
      expect(profile.name).toBe("solo");
    });
  });

  test("falls back to env vars when no config file exists", async () => {
    const configPath = join(await mkdtemp(join(tmpdir(), "squidex-mcp-test-")), "does-not-exist.json");
    const env = {
      SQUIDEX_URL: "https://cloud.squidex.io",
      SQUIDEX_APP: "env-app",
      SQUIDEX_CLIENT_ID: "id",
      SQUIDEX_CLIENT_SECRET: "secret",
    };
    const profile = await resolveProfile(undefined, { configPath, env });
    expect(profile.name).toBe("default");
    expect(profile.app).toBe("env-app");
  });

  test("throws ConfigError when neither config file nor env vars are present", async () => {
    const configPath = join(await mkdtemp(join(tmpdir(), "squidex-mcp-test-")), "does-not-exist.json");
    await expect(resolveProfile(undefined, { configPath, env: {} })).rejects.toThrow(ConfigError);
  });
});

describe("listProfileNames", () => {
  test("lists names without exposing secrets", async () => {
    await withConfigFile(validConfig, async (configPath) => {
      const names = await listProfileNames({ configPath });
      expect(names.sort()).toEqual(["prod", "staging"]);
    });
  });
});
