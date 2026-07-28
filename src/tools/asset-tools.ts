import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { resolveProfile } from "@/config/profiles";
import { getAsset, listAssets, uploadAsset } from "@/squidex/assets";
import { runTool } from "./run-tool";
import { jsonResult } from "./tool-result";

const profileParam = z.string().optional().describe("Profile name from squidex.config.json; uses the default profile if omitted.");
const idParam = z.string().describe("Asset id.");

export function registerAssetTools(server: McpServer): void {
  server.registerTool(
    "asset_list",
    {
      description: "List/query assets in a Squidex app's asset library — use asset_get's id (or an asset field's value) to reference an existing asset from content, or check what's already uploaded before asset_upload.",
      inputSchema: {
        profile: profileParam,
        parentId: z.string().optional().describe("Restrict to assets inside this folder id; omit for the root folder."),
        ids: z.array(z.string()).optional().describe("Fetch specific assets by id instead of listing a folder."),
        filter: z.string().optional().describe("OData $filter expression."),
        orderby: z.string().optional().describe("OData $orderby expression."),
        top: z.number().int().positive().optional().describe("Max items to return."),
        skip: z.number().int().nonnegative().optional().describe("Items to skip, for pagination."),
      },
    },
    ({ profile: profileName, parentId, ids, filter, orderby, top, skip }) =>
      runTool("asset_list", async () => {
        const profile = await resolveProfile(profileName);
        return jsonResult(await listAssets(profile, { parentId, ids, filter, orderby, top, skip }));
      }),
  );

  server.registerTool(
    "asset_get",
    {
      description: "Get a single asset's metadata (file name, mime type, size, slug) by id.",
      inputSchema: { profile: profileParam, id: idParam },
    },
    ({ profile: profileName, id }) =>
      runTool("asset_get", async () => {
        const profile = await resolveProfile(profileName);
        return jsonResult(await getAsset(profile, id));
      }),
  );

  server.registerTool(
    "asset_upload",
    {
      description:
        "Upload a new asset — needed before a content item's Assets field can reference it. Provide exactly one of filePath (reads a local file) or url (Squidex fetches it server-side).",
      inputSchema: {
        profile: profileParam,
        filePath: z.string().optional().describe("Absolute path to a local file to upload. Exactly one of filePath/url is required."),
        url: z.string().optional().describe("Remote URL Squidex fetches the file from. Exactly one of filePath/url is required."),
        fileName: z.string().optional().describe("Stored file name; required with url, defaults to the local file's basename with filePath."),
        mimeType: z.string().optional().describe('MIME type, e.g. "image/png" — Squidex doesn\'t sniff it from the upload, so pass it when known.'),
        parentId: z.string().optional().describe("Folder id to upload into; omit for the root folder."),
        duplicate: z.boolean().optional().describe("Create a new asset even if identical file content already exists."),
      },
    },
    ({ profile: profileName, filePath, url, fileName, mimeType, parentId, duplicate }) =>
      runTool("asset_upload", async () => {
        if (Boolean(filePath) === Boolean(url)) {
          throw new Error("asset_upload requires exactly one of filePath or url.");
        }
        const profile = await resolveProfile(profileName);
        return jsonResult(await uploadAsset(profile, { filePath, url, fileName, mimeType, parentId, duplicate }));
      }),
  );
}
