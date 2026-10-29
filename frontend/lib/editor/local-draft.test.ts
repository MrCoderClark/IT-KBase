import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EditorDraft } from "./draft";
import { mergeLocalOverServer } from "./local-draft";

function draft(overrides: Partial<EditorDraft> = {}): EditorDraft {
  return {
    slug: "reset-local-admin-password",
    version: "1.0",
    title: "Reset local admin password",
    summary: "",
    categorySlug: null,
    tagSlugs: [],
    status: "published",
    visibility: "private",
    sections: [],
    parentId: null,
    ...overrides,
  };
}

describe("mergeLocalOverServer", () => {
  it("keeps published status when the local mirror says draft", () => {
    const server = draft({ status: "published", title: "Server title" });
    const local = draft({ status: "draft", title: "Local edits" });
    const merged = mergeLocalOverServer(server, local);
    assert.equal(merged.status, "published");
    assert.equal(merged.title, "Local edits");
  });

  it("keeps archived status and visibility from the server", () => {
    const server = draft({ status: "archived", visibility: "private" });
    const local = draft({ status: "draft", visibility: "public", title: "Tweak" });
    const merged = mergeLocalOverServer(server, local);
    assert.equal(merged.status, "archived");
    assert.equal(merged.visibility, "private");
    assert.equal(merged.title, "Tweak");
  });

  it("allows local status for draft articles", () => {
    const server = draft({ status: "draft" });
    const local = draft({ status: "in_review", title: "Ready" });
    const merged = mergeLocalOverServer(server, local);
    assert.equal(merged.status, "in_review");
    assert.equal(merged.title, "Ready");
  });
});
