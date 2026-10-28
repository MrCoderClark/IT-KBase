import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { relatedSearchText } from "./related";

describe("relatedSearchText", () => {
  it("joins title, tags, and summary", () => {
    assert.equal(
      relatedSearchText({
        title: "Reset local admin",
        summary: "Use net user on the workstation.",
        tags: [{ name: "Windows" }, { name: "Accounts" }],
      }),
      "Reset local admin Windows Accounts Use net user on the workstation.",
    );
  });

  it("returns null when there is nothing usable", () => {
    assert.equal(relatedSearchText({ title: " ", summary: null, tags: [] }), null);
    assert.equal(relatedSearchText({ title: "a" }), null);
  });

  it("caps a long summary", () => {
    const text = relatedSearchText({
      title: "BitLocker",
      summary: "x".repeat(300),
    });
    assert.equal(text?.length, 200);
  });
});
