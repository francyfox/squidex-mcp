import { readFile } from "node:fs/promises";
import { DEFAULT_REQUEST_TIMEOUT_MS } from "@/squidex/constants";
import { ConfigError } from "@/squidex/errors";
import { configFileSchema, envProfileSchema, type SquidexConfigFile, type SquidexProfile } from "./profile-schema";

export interface ResolvedProfile extends SquidexProfile {
  name: string;
  /** Shared across all profiles — read from squidex.config.json's top-level requestTimeoutMs. */
  requestTimeoutMs: number;
}

export interface ResolveProfileOptions {
  /** Overrides the config file path; defaults to $SQUIDEX_MCP_CONFIG or ./squidex.config.json */
  configPath?: string;
  /** Overrides the environment used for the env-var fallback profile; defaults to process.env */
  env?: Record<string, string | undefined>;
}

const DEFAULT_CONFIG_PATH = "squidex.config.json";
const ENV_PROFILE_NAME = "default";
const ENV_VAR_NAMES = ["SQUIDEX_URL", "SQUIDEX_APP", "SQUIDEX_CLIENT_ID", "SQUIDEX_CLIENT_SECRET"] as const;

async function loadConfigFile(path: string): Promise<SquidexConfigFile | undefined> {
  let contents: string;
  try {
    contents = await readFile(path, "utf-8");
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT") return undefined;
    throw new ConfigError(`Failed to read ${path}: ${(err as Error).message}`);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(contents);
  } catch (err) {
    throw new ConfigError(`Failed to parse ${path} as JSON: ${(err as Error).message}`);
  }

  const parsed = configFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ConfigError(`Invalid ${path}: ${parsed.error.message}`);
  }
  return parsed.data;
}

function profileFromEnv(env: Record<string, string | undefined>): SquidexProfile | undefined {
  const parsed = envProfileSchema.safeParse(env);
  if (!parsed.success) return undefined;
  return {
    url: parsed.data.SQUIDEX_URL,
    app: parsed.data.SQUIDEX_APP,
    clientId: parsed.data.SQUIDEX_CLIENT_ID,
    clientSecret: parsed.data.SQUIDEX_CLIENT_SECRET,
  };
}

/** Distinguishes "nothing configured" from "partially/incorrectly configured" for a clearer error. */
function describeEnvValidationFailure(env: Record<string, string | undefined>): string {
  const anySet = ENV_VAR_NAMES.some((key) => env[key] !== undefined);
  if (!anySet) return "no SQUIDEX_URL/SQUIDEX_APP/SQUIDEX_CLIENT_ID/SQUIDEX_CLIENT_SECRET env vars set";

  const parsed = envProfileSchema.safeParse(env);
  const issues = parsed.success ? [] : parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  return `incomplete/invalid Squidex env vars — ${issues.join("; ")}`;
}

function soleProfileName(profiles: Record<string, SquidexProfile>, configPath: string): string {
  const names = Object.keys(profiles);
  const [only] = names;
  if (names.length === 1 && only !== undefined) return only;
  throw new ConfigError(
    `No profile specified and no defaultProfile set in ${configPath}. Known profiles: ${names.join(", ") || "(none)"}`,
  );
}

/** Reads squidex.config.json fresh (no caching), so switching profiles never requires a server restart. */
export async function resolveProfile(name?: string, options: ResolveProfileOptions = {}): Promise<ResolvedProfile> {
  const path = options.configPath ?? process.env.SQUIDEX_MCP_CONFIG ?? DEFAULT_CONFIG_PATH;
  const env = options.env ?? process.env;
  const config = await loadConfigFile(path);

  if (!config) {
    const envProfile = profileFromEnv(env);
    if (!envProfile) {
      throw new ConfigError(`No ${path} found and ${describeEnvValidationFailure(env)}.`);
    }
    if (name && name !== ENV_PROFILE_NAME) {
      throw new ConfigError(`Profile "${name}" requested, but no ${path} exists to look it up in.`);
    }
    return { name: ENV_PROFILE_NAME, requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS, ...envProfile };
  }

  const profileName = name ?? config.defaultProfile ?? soleProfileName(config.profiles, path);
  const profile = config.profiles[profileName];
  if (!profile) {
    const known = Object.keys(config.profiles).join(", ") || "(none)";
    throw new ConfigError(`Unknown profile "${profileName}". Known profiles: ${known}`);
  }
  return {
    name: profileName,
    requestTimeoutMs: config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
    ...profile,
  };
}

/** Lists configured profile names only — never secrets. */
export async function listProfileNames(options: ResolveProfileOptions = {}): Promise<string[]> {
  const path = options.configPath ?? process.env.SQUIDEX_MCP_CONFIG ?? DEFAULT_CONFIG_PATH;
  const env = options.env ?? process.env;
  const config = await loadConfigFile(path);
  if (!config) {
    return profileFromEnv(env) ? [ENV_PROFILE_NAME] : [];
  }
  return Object.keys(config.profiles);
}
