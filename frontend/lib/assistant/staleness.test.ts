import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { outdatedReferences, stalenessInfo, STALE_AFTER_DAYS } from "./staleness";

const NOW = new Date("2026-11-12T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

describe("stalenessInfo", () => {
  it("flags an article untouched for 12+ months", () => {
    const info = stalenessInfo(daysAgo(400), NOW);
    assert.equal(info.stale, true);
    assert.equal(info.days, 400);
    assert.equal(info.months, 13);
  });

  it("does not flag a recently updated article", () => {
    const info = stalenessInfo(daysAgo(30), NOW);
    assert.equal(info.stale, false);
    assert.equal(info.months, 1);
  });

  it("treats exactly the cutoff as stale and clamps future dates to zero", () => {
    assert.equal(stalenessInfo(daysAgo(STALE_AFTER_DAYS), NOW).stale, true);
    const future = stalenessInfo(new Date(NOW.getTime() + 86_400_000), NOW);
    assert.equal(future.days, 0);
    assert.equal(future.stale, false);
  });
});

describe("outdatedReferences", () => {
  it("flags renamed and end-of-life terms, with a suggestion each", () => {
    const text = "Open Azure AD, then run the steps on Windows Server 2012 R2.";
    const found = outdatedReferences(text).map((m) => m.label).sort();
    assert.deepEqual(found, ["Azure AD", "Windows Server 2012"]);
    assert.ok(outdatedReferences("Azure AD")[0]?.suggest.includes("Entra ID"));
  });

  it("reports each pattern at most once", () => {
    const text = "Windows 10 here, Windows 10 there, Windows 10 everywhere.";
    assert.equal(outdatedReferences(text).length, 1);
  });

  it("does not trip on modern text", () => {
    const text = "Configure Microsoft Entra ID on Windows 11 24H2 with TLS 1.2.";
    assert.deepEqual(outdatedReferences(text), []);
  });

  it("matches IE11 without matching the word 'die' or similar", () => {
    assert.equal(outdatedReferences("Launch IE11 to continue.").length, 1);
    assert.deepEqual(outdatedReferences("The pipeline is idempotent."), []);
  });
});
