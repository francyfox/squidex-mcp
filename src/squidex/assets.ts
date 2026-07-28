import { basename } from "node:path";
import { readFile } from "node:fs/promises";
import type { ResolvedProfile } from "@/config/profiles";
import { squidexFetch, squidexUpload } from "./http";

export interface AssetItem {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  slug: string;
  parentId?: string;
  [key: string]: unknown;
}

export interface AssetListResult {
  total: number;
  items: AssetItem[];
}

export interface AssetListParams {
  /** Restrict to assets inside a folder; omit for the root folder. */
  parentId?: string;
  /** Fetch specific assets by id instead of listing a folder. */
  ids?: string[];
  top?: number;
  skip?: number;
  filter?: string;
  orderby?: string;
}

export async function listAssets(profile: ResolvedProfile, params: AssetListParams = {}): Promise<AssetListResult> {
  return squidexFetch<AssetListResult>(profile, {
    path: `/api/apps/${profile.app}/assets`,
    query: {
      parentId: params.parentId,
      ids: params.ids?.join(","),
      $top: params.top,
      $skip: params.skip,
      $filter: params.filter,
      $orderby: params.orderby,
    },
  });
}

export async function getAsset(profile: ResolvedProfile, id: string): Promise<AssetItem> {
  return squidexFetch<AssetItem>(profile, { path: `/api/apps/${profile.app}/assets/${id}` });
}

export interface UploadAssetParams {
  /** Absolute path to a local file to read and upload. Exactly one of filePath/url must be set. */
  filePath?: string;
  /** Remote URL Squidex fetches the file from server-side. Exactly one of filePath/url must be set. */
  url?: string;
  /** Stored file name; required with `url`, defaults to the local file's basename with `filePath`. */
  fileName?: string;
  /** Squidex doesn't sniff content type from the upload — pass it explicitly when known. */
  mimeType?: string;
  parentId?: string;
  /** Create a new asset even if the same file content already exists. */
  duplicate?: boolean;
}

export async function uploadAsset(profile: ResolvedProfile, params: UploadAssetParams): Promise<AssetItem> {
  const form = new FormData();

  if (params.filePath) {
    const bytes = await readFile(params.filePath);
    const fileName = params.fileName ?? basename(params.filePath);
    form.append("file", new Blob([bytes], { type: params.mimeType ?? "application/octet-stream" }), fileName);
  } else if (params.url) {
    form.append("url", params.url);
    if (params.fileName) form.append("name", params.fileName);
  } else {
    throw new Error("uploadAsset requires either filePath or url");
  }

  return squidexUpload<AssetItem>(profile, {
    path: `/api/apps/${profile.app}/assets`,
    method: "POST",
    query: { parentId: params.parentId, duplicate: params.duplicate },
    form,
  });
}
