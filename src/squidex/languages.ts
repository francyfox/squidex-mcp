import type { ResolvedProfile } from "@/config/profiles";
import { squidexFetch } from "./http";

export interface AppLanguage {
  iso2Code: string;
  englishName: string;
  isMaster: boolean;
  isOptional: boolean;
  fallback: string[];
}

/** The language codes configured for an app — the partition keys content_create/content_update must use for localized fields. */
export async function listLanguages(profile: ResolvedProfile): Promise<AppLanguage[]> {
  const result = await squidexFetch<{ items: AppLanguage[] }>(profile, {
    path: `/api/apps/${profile.app}/languages`,
  });
  return result.items;
}
