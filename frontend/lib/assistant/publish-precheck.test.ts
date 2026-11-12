import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { blankDraft, type EditorDraft } from "@/lib/editor/draft";
import { publishPreCheck } from "./publish-precheck";

/** A draft that passes every required gate and fills every canonical section. */
function publishableDraft(): EditorDraft {
  const draft = blankDraft();
  draft.title = "Reset the local administrator password";
  draft.summary = "Recover access to a Windows 11 host when the local admin password is lost.";
  draft.categorySlug = "windows";
  draft.tagSlugs = ["windows-11"];
  for (const section of draft.sections) {
    switch (section.kind) {
      case "overview":
        section.prose = "Resets the local administrator password on Windows 11.";
        break;
      case "prerequisites":
        section.items = ["Bootable Windows 11 installation media"];
        break;
      case "steps":
        section.steps = [
          { title: "Boot into WinRE", body: "Hold Shift and restart.", code: "", language: "powershell" },
        ];
        break;
      case "verification":
        section.items = ["Sign in with the new password"];
        break;
      case "troubleshooting":
        section.callouts = [{ variant: "warning", title: "WinRE missing", body: "Use installation media." }];
        break;
    }
  }
  return draft;
}

describe("publishPreCheck", () => {
  it("passes a complete draft with no warnings", () => {
    const result = publishPreCheck(publishableDraft());
    assert.equal(result.ok, true);
    assert.ok(result.required.every((check) => check.ok));
    assert.deepEqual(result.warnings, []);
  });

  it("fails and names the missing required gates", () => {
    const result = publishPreCheck(blankDraft());
    assert.equal(result.ok, false);
    const failing = result.required.filter((check) => !check.ok).map((check) => check.id).sort();
    assert.deepEqual(failing, ["category", "step", "summary", "tag", "title"]);
  });

  it("stays publishable while surfacing B4 section warnings", () => {
    const draft = publishableDraft();
    const verification = draft.sections.find((s) => s.kind === "verification");
    if (verification?.kind === "verification") {
      verification.items = [""];
      verification.code = "";
    }
    const result = publishPreCheck(draft);
    assert.equal(result.ok, true); // required gates still pass — publish is not blocked
    assert.equal(result.warnings.length, 1);
    assert.equal(result.warnings[0]?.kind, "missing-section");
    assert.equal(result.warnings[0]?.label, "Verification");
    assert.equal(result.warnings[0]?.severity, "important");
  });

  it("does not double-report an empty steps section already gated as required", () => {
    const draft = publishableDraft();
    const steps = draft.sections.find((s) => s.kind === "steps");
    if (steps?.kind === "steps") steps.steps = [];
    const result = publishPreCheck(draft);
    assert.equal(result.ok, false); // the required "step" gate fails
    assert.ok(result.required.some((check) => check.id === "step" && !check.ok));
    assert.ok(!result.warnings.some((w) => w.kind === "missing-section" && w.label === "Step-by-Step"));
  });

  it("flags a risky command as an important warning without blocking publish", () => {
    const draft = publishableDraft();
    const steps = draft.sections.find((s) => s.kind === "steps");
    if (steps?.kind === "steps") {
      steps.steps = [{ title: "Clean up", body: "", code: "rm -rf /var/log", language: "bash" }];
    }
    const result = publishPreCheck(draft);
    assert.equal(result.ok, true);
    const risky = result.warnings.filter((w) => w.kind === "risky-command");
    assert.equal(risky.length, 1);
    assert.equal(risky[0]?.label, "rm -rf");
    assert.equal(risky[0]?.severity, "important");
  });

  it("orders important warnings before advisory ones", () => {
    const draft = publishableDraft();
    // Clear an optional (prerequisites → advisory) and an important (verification) section.
    const prereqs = draft.sections.find((s) => s.kind === "prerequisites");
    if (prereqs?.kind === "prerequisites") prereqs.items = [];
    const verification = draft.sections.find((s) => s.kind === "verification");
    if (verification?.kind === "verification") {
      verification.items = [];
      verification.code = "";
    }
    const result = publishPreCheck(draft);
    assert.equal(result.warnings.length, 2);
    assert.equal(result.warnings[0]?.severity, "important");
    assert.equal(result.warnings[1]?.severity, "advisory");
  });
});
