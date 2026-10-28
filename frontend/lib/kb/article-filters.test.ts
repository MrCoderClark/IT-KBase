import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  articleFacetsQuery,
  articleFacetsToSearchParams,
  hasArticleFacets,
  parseArticleFacets,
  updatedWithinCutoff,
} from "./article-filters";

describe("parseArticleFacets", () => {
  it("keeps known values and drops junk", () => {
    assert.deepEqual(
      parseArticleFacets({
        category: " windows ",
        status: "published",
        updated: "30d",
      }),
      { category: "windows", status: "published", updated: "30d" },
    );
    assert.deepEqual(
      parseArticleFacets({ category: "", status: "nope", updated: "1y" }),
      { category: null, status: null, updated: null },
    );
  });

  it("respects allowed statuses", () => {
    assert.deepEqual(
      parseArticleFacets({ status: "archived" }, ["published", "draft"]),
      { category: null, status: null, updated: null },
    );
    assert.deepEqual(
      parseArticleFacets({ status: "draft" }, ["published", "draft"]),
      { category: null, status: "draft", updated: null },
    );
  });
});

describe("updatedWithinCutoff", () => {
  it("is roughly N days before now", () => {
    const before = Date.now() - 7 * 24 * 60 * 60 * 1000 - 2000;
    const cutoff = updatedWithinCutoff("7d").getTime();
    const after = Date.now() - 7 * 24 * 60 * 60 * 1000 + 2000;
    assert.ok(cutoff >= before && cutoff <= after);
  });
});

describe("facet query helpers", () => {
  it("builds API and URL params", () => {
    assert.equal(articleFacetsQuery({ category: null, status: null, updated: null }), "");
    assert.equal(
      articleFacetsQuery({ category: "windows", status: "published", updated: "7d" }),
      "&category=windows&status=published&updated=7d",
    );
    assert.equal(hasArticleFacets({ category: "a", status: null, updated: null }), true);

    const params = articleFacetsToSearchParams({
      category: "linux",
      status: null,
      updated: "90d",
    });
    assert.equal(params.get("category"), "linux");
    assert.equal(params.get("updated"), "90d");
    assert.equal(params.has("status"), false);
  });
});
