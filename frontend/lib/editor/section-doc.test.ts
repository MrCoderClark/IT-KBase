import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calloutsDoc,
  calloutsFromDoc,
  checklistDoc,
  checklistFromDoc,
  stepsDoc,
  stepsFromDoc,
  verificationDoc,
  verificationFromDoc,
} from "./section-doc";

describe("section docs", () => {
  it("round-trips checklist items", () => {
    const items = ["Admin rights", "VPN connected"];
    assert.deepEqual(checklistFromDoc(checklistDoc(items)), items);
  });

  it("round-trips steps including code", () => {
    const steps = [
      {
        title: "Open PowerShell",
        body: "<p>As admin</p>",
        code: "Start-Process",
        language: "powershell",
      },
    ];
    assert.deepEqual(stepsFromDoc(stepsDoc(steps)), steps);
  });

  it("keeps a verification command block", () => {
    const next = verificationFromDoc(
      verificationDoc(["DNS resolves"], "nslookup host", "powershell"),
    );
    assert.deepEqual(next.items, ["DNS resolves"]);
    assert.equal(next.code, "nslookup host");
    assert.equal(next.language, "powershell");
  });

  it("round-trips callouts", () => {
    const callouts = [{ variant: "warning" as const, title: "Locked", body: "Reboot first." }];
    assert.deepEqual(calloutsFromDoc(calloutsDoc(callouts)), callouts);
  });
});
