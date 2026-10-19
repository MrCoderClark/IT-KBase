import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { searchQuery, splitSnippet } from "./search";

describe("search query", () => {
  it("ignores a single character and keeps a phrase", () => {
    assert.equal(searchQuery("  "), null);
    assert.equal(searchQuery("a"), null);
    assert.equal(searchQuery("  net   user "), "net user");
  });

  it("caps a very long query", () => {
    assert.equal(searchQuery("x".repeat(90))?.length, 80);
  });
});

describe("snippet", () => {
  it("marks the matched words and leaves the rest plain", () => {
    assert.deepEqual(splitSnippet("Run \u0001net user\u0002 next"), [
      { text: "Run ", hit: false },
      { text: "net user", hit: true },
      { text: " next", hit: false },
    ]);
  });
});
