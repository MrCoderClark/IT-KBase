import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { blankDraft, type EditorDraft } from "@/lib/editor/draft";
import { editorDraftToText } from "./draft-text";

function draftWith(mutate: (draft: EditorDraft) => void): EditorDraft {
  const draft = blankDraft();
  draft.title = "Reset the admin password";
  mutate(draft);
  return draft;
}

describe("editorDraftToText", () => {
  it("includes the title and fences step code", () => {
    const draft = draftWith((d) => {
      const steps = d.sections.find((s) => s.kind === "steps");
      if (steps?.kind === "steps") {
        steps.steps = [
          { title: "Enable the account", body: "<p>Run this.</p>", code: "net user Administrator /active:yes", language: "powershell" },
        ];
      }
    });
    const text = editorDraftToText(draft);
    assert.match(text, /Title: Reset the admin password/);
    assert.match(text, /1\. Enable the account/);
    assert.match(text, /Run this\./); // HTML stripped
    assert.match(text, /```\nnet user Administrator \/active:yes\n```/);
  });

  it("omits empty sections", () => {
    const text = editorDraftToText(draftWith(() => {}));
    assert.ok(!text.includes("Prerequisites:"));
    assert.ok(!text.includes("Steps:"));
  });
});
