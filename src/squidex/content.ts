import type { ResolvedProfile } from "@/config/profiles";
import { squidexFetch } from "./http";

export interface ContentQueryParams {
  filter?: string;
  top?: number;
  skip?: number;
  orderby?: string;
  search?: string;
}

export interface ContentItem {
  id: string;
  data: Record<string, unknown>;
  status?: string;
  [key: string]: unknown;
}

export interface ContentQueryResult {
  total: number;
  items: ContentItem[];
}

export type ContentStatus = "Draft" | "Published" | "Archived";

/** Pure — builds the OData-style query for the content list endpoint. No fetch, no mocking needed to test it. */
export function buildContentQueryUrl(
  profile: ResolvedProfile,
  schema: string,
  params: ContentQueryParams,
): { path: string; query: Record<string, string | number | undefined> } {
  return {
    path: `/api/content/${profile.app}/${schema}`,
    query: {
      $top: params.top,
      $skip: params.skip,
      $filter: params.filter,
      $orderby: params.orderby,
      $search: params.search,
    },
  };
}

export async function queryContents(
  profile: ResolvedProfile,
  schema: string,
  params: ContentQueryParams = {},
): Promise<ContentQueryResult> {
  const { path, query } = buildContentQueryUrl(profile, schema, params);
  return squidexFetch<ContentQueryResult>(profile, { path, query });
}

export async function getContent(profile: ResolvedProfile, schema: string, id: string): Promise<ContentItem> {
  return squidexFetch<ContentItem>(profile, { path: `/api/content/${profile.app}/${schema}/${id}` });
}

export async function createContent(
  profile: ResolvedProfile,
  schema: string,
  data: Record<string, unknown>,
  publish = false,
): Promise<ContentItem> {
  return squidexFetch<ContentItem>(profile, {
    path: `/api/content/${profile.app}/${schema}`,
    method: "POST",
    query: { publish },
    body: data,
  });
}

export async function updateContent(
  profile: ResolvedProfile,
  schema: string,
  id: string,
  data: Record<string, unknown>,
): Promise<ContentItem> {
  return squidexFetch<ContentItem>(profile, {
    path: `/api/content/${profile.app}/${schema}/${id}`,
    method: "PUT",
    body: data,
  });
}

export async function deleteContent(profile: ResolvedProfile, schema: string, id: string): Promise<void> {
  await squidexFetch<void>(profile, {
    path: `/api/content/${profile.app}/${schema}/${id}`,
    method: "DELETE",
  });
}

export async function changeContentStatus(
  profile: ResolvedProfile,
  schema: string,
  id: string,
  status: ContentStatus,
): Promise<ContentItem> {
  return squidexFetch<ContentItem>(profile, {
    path: `/api/content/${profile.app}/${schema}/${id}/status`,
    method: "PUT",
    body: { status },
  });
}
