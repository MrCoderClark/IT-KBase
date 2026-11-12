import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { draftSearchText } from "./duplicates";

describe("draftSearchText", () => {
  it("combines title, tag names, and summary into one query", () => {
    const text = draftSearchText({
      title: "Reset local administrator password",
      summary: "Recover access when the password is lost.",
      tagNames: ["Windows 11", "Recovery"],
    });
    assert.ok(text);
    assert.match(text, /Reset local administrator password/);
    assert.match(text, /Windows 11/);
    assert.match(text, /Recovery/);
  });

  it("returns null when there is no usable signal", () => {
    assert.equal(draftSearchText({ title: "", summary: "", tagNames: [] }), null);
  });
});
