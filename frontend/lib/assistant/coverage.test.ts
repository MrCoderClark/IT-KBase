import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildGapClusters, coverageStats, withinDays, type GapRow } from "./coverage";

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

function gapQ(question: string, askCount: number, days: number): GapRow {
  return { normalized: question.toLowerCase(), sampleQuestion: question, askCount, lastAskedAt: daysAgo(days) };
}

describe("buildGapClusters", () => {
  const gaps = [
    gapQ("How do I re-register MFA?", 10, 2),
    gapQ("Reset my authenticator app", 4, 5),
    gapQ("VPN won't connect from home", 6, 1),
  ];

  it("sums demand per cluster, ranks by demand, and keeps the latest ask", () => {
    const clusters = buildGapClusters(gaps, [
      { label: "VPN", theme: "Home VPN.", gapIds: ["2"] },
      { label: "MFA", theme: "Resetting MFA.", gapIds: ["0", "1"] },
    ]);
    // MFA (10+4=14) outranks VPN (6) despite being listed second.
    assert.deepEqual(
      clusters.map((c) => [c.label, c.askCount, c.gapCount]),
      [
        ["MFA", 14, 2],
        ["VPN", 6, 1],
      ],
    );
    assert.equal(clusters[0].lastAskedAt, daysAgo(2)); // most recent of the two
    assert.deepEqual(clusters[0].questions, ["How do I re-register MFA?", "Reset my authenticator app"]);
  });

  it("claims each gap once (first cluster wins) and ignores bad ids", () => {
    const clusters = buildGapClusters(gaps, [
      { label: "A", theme: "", gapIds: ["0", "1", "99", "0"] },
      { label: "B", theme: "", gapIds: ["1", "2"] }, // 1 already claimed by A
    ]);
    assert.equal(clusters.find((c) => c.label === "A")?.gapCount, 2); // 0 and 1
    assert.equal(clusters.find((c) => c.label === "B")?.gapCount, 1); // only 2
  });

  it("drops clusters with no valid members", () => {
    const clusters = buildGapClusters(gaps, [{ label: "Ghost", theme: "", gapIds: ["42"] }]);
    assert.deepEqual(clusters, []);
  });
});
