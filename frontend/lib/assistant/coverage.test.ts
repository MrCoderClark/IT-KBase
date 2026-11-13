import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coverageStats, withinDays, type GapRow } from "./coverage";

const NOW = new Date("2026-11-13T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

function gap(askCount: number, days: number): GapRow {
  return {
    normalized: `gap-${askCount}-${days}`,
    sampleQuestion: "How do I re-register MFA?",
    askCount,
    lastAskedAt: daysAgo(days),
  };
}

describe("withinDays", () => {
  it("is true inside the window and false outside, and false for a bad date", () => {
    assert.equal(withinDays(daysAgo(10), NOW, 30), true);
    assert.equal(withinDays(daysAgo(40), NOW, 30), false);
    assert.equal(withinDays("not-a-date", NOW, 30), false);
  });
});

describe("coverageStats", () => {
  it("sums demand and counts gaps active in the last 30 days", () => {
    const stats = coverageStats([gap(14, 5), gap(3, 20), gap(8, 60)], NOW);
    assert.equal(stats.openCount, 3);
    assert.equal(stats.totalAsks, 25); // 14 + 3 + 8
    assert.equal(stats.activeThisMonth, 2); // the 5- and 20-day gaps
  });

  it("is zeroed for no gaps", () => {
    assert.deepEqual(coverageStats([], NOW), {
      openCount: 0,
      totalAsks: 0,
      activeThisMonth: 0,
    });
  });
});
