import { z } from "zod";

export const profileSchema = z.object({
  url: z.url(),
  app: z.string().min(1),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
});

export const configFileSchema = z.object({
  defaultProfile: z.string().optional(),
  /** Shared across all profiles — not a per-profile setting. Defaults to DEFAULT_REQUEST_TIMEOUT_MS. */
  requestTimeoutMs: z.number().int().positive().optional(),
  profiles: z.record(z.string(), profileSchema),
});

/** Fallback profile sourced from env vars when no squidex.config.json exists. */
export const envProfileSchema = z.object({
  SQUIDEX_URL: z.url(),
  SQUIDEX_APP: z.string().min(1),
  SQUIDEX_CLIENT_ID: z.string().min(1),
  SQUIDEX_CLIENT_SECRET: z.string().min(1),
});

export type SquidexProfile = z.infer<typeof profileSchema>;
export type SquidexConfigFile = z.infer<typeof configFileSchema>;
