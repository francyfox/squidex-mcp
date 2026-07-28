import { describe, expect, test } from "bun:test";
import type { ResolvedProfile } from "@/config/profiles";
import { buildContentQueryUrl } from "./content";

const profile: ResolvedProfile = {
  name: "prod",
  url: "https://cloud.squidex.io",
  app: "blog",
  clientId: "client-id",
  clientSecret: "client-secret",
  requestTimeoutMs: 15_000,
};

describe("buildContentQueryUrl", () => {
  test("targets the schema's content endpoint", () => {
    const { path } = buildContentQueryUrl(profile, "posts", {});
    expect(path).toBe("/api/content/blog/posts");
  });

  test("maps params to their OData query names, omitting unset ones", () => {
    const { query } = buildContentQueryUrl(profile, "posts", { top: 10, skip: 20 });
    expect(query).toEqual({
      $top: 10,
      $skip: 20,
      $filter: undefined,
      $orderby: undefined,
      $search: undefined,
    });
  });

  test("passes through filter, orderby and search verbatim", () => {
    const { query } = buildContentQueryUrl(profile, "posts", {
      filter: "data/title/iv contains 'foo'",
      orderby: "created desc",
      search: "hello",
    });
    expect(query.$filter).toBe("data/title/iv contains 'foo'");
    expect(query.$orderby).toBe("created desc");
    expect(query.$search).toBe("hello");
  });
});
