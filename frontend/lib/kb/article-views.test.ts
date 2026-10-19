import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { articleViewerKey, viewDay } from "./article-views";

describe("view day", () => {
  it("uses the UTC date", () => {
    assert.equal(viewDay(new Date("2026-10-19T23:30:00.000Z")), "20261019");
    assert.equal(viewDay(new Date("2026-10-20T00:30:00.000Z")), "20261020");
  });
});

describe("viewer key", () => {
  it("prefers the signed-in user over the anonymous browser id", () => {
    assert.equal(articleViewerKey("user-1", "browser-9"), "user:user-1");
    assert.equal(articleViewerKey(null, "browser-9"), "anon:browser-9");
  });
});
