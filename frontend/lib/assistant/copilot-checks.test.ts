import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { blankDraft, type EditorDraft } from "@/lib/editor/draft";
import { missingSections, riskyCommands } from "./copilot-checks";

/** blankDraft() has all five editable sections present but empty. */
function filledDraft(): EditorDraft {
  const draft = blankDraft();
  for (const section of draft.sections) {
    switch (section.kind) {
      case "overview":
        section.prose = "Resets the local administrator password on Windows 11.";
        break;
      case "prerequisites":
        section.items = ["Bootable Windows 11 installation media"];
        break;
      case "steps":
        section.steps = [{ title: "Boot into WinRE", body: "Hold Shift and restart.", code: "", language: "powershell" }];
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

describe("missingSections", () => {
  it("flags every section of a blank draft, important ones first", () => {
    const suggestions = missingSections(blankDraft());
    assert.equal(suggestions.length, 5);
    // overview, steps, verification are important and must lead.
    const leadKinds = suggestions.slice(0, 3).map((s) => s.kind).sort();
    assert.deepEqual(leadKinds, ["overview", "steps", "verification"]);
    assert.ok(suggestions.slice(0, 3).every((s) => s.priority === "important"));
  });

  it("returns nothing when every canonical section has content", () => {
    assert.deepEqual(missingSections(filledDraft()), []);
  });

  it("flags only the empty section", () => {
    const draft = filledDraft();
    const verification = draft.sections.find((s) => s.kind === "verification");
    if (verification?.kind === "verification") {
      verification.items = [""];
      verification.code = "";
    }
    const suggestions = missingSections(draft);
    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0]?.kind, "verification");
  });
});

describe("riskyCommands", () => {
  function draftWithStepCode(code: string): EditorDraft {
    const draft = blankDraft();
    const steps = draft.sections.find((s) => s.kind === "steps");
    if (steps?.kind === "steps") {
      steps.steps = [{ title: "Clean up", body: "", code, language: "powershell" }];
    }
    return draft;
  }

  it("flags a destructive Remove-Item and an rm -rf", () => {
    const draft = draftWithStepCode("Remove-Item -Recurse -Force C:\\temp\nrm -rf /var/log");
    const matches = riskyCommands(draft);
    assert.equal(matches.length, 2);
    assert.ok(matches.some((m) => m.label === "Remove-Item -Recurse"));
    assert.ok(matches.some((m) => m.label === "rm -rf"));
    assert.ok(matches.every((m) => m.where.startsWith("Step 1")));
  });

  it("flags DROP TABLE in the verification code block", () => {
    const draft = blankDraft();
    const verification = draft.sections.find((s) => s.kind === "verification");
    if (verification?.kind === "verification") {
      verification.code = "SELECT 1;\nDROP TABLE audit_log;";
    }
    const matches = riskyCommands(draft);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.label, "DROP / TRUNCATE");
  });

  it("does not flag safe commands or a --format flag", () => {
    const draft = draftWithStepCode("Get-Process | ConvertTo-Json\ngit log --format json");
    assert.deepEqual(riskyCommands(draft), []);
  });
});
