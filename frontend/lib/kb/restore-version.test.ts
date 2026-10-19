import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { restoreRefusal, restoredFromNote } from "./restore-version";

describe("restore refusal", () => {
  it("refuses a missing version, another article, and the current row", () => {
    assert.equal(
      restoreRefusal({ articleId: "a", currentVersionId: "cur", selected: null }),
      "missing",
    );
    assert.equal(
      restoreRefusal({
        articleId: "a",
        currentVersionId: "cur",
        selected: { id: "old", articleId: "b" },
      }),
      "other",
    );
    assert.equal(
      restoreRefusal({
        articleId: "a",
        currentVersionId: "cur",
        selected: { id: "cur", articleId: "a" },
      }),
      "current",
    );
  });

  it("allows an older version of the same article", () => {
    assert.equal(
      restoreRefusal({
        articleId: "a",
        currentVersionId: "cur",
        selected: { id: "old", articleId: "a" },
      }),
      null,
    );
    assert.equal(restoredFromNote("1.6"), "Restored from 1.6");
  });
});
