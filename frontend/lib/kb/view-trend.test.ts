import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fillTrend, helpfulRatioLabel, sparklinePoints, trendDays, trendSummary } from "./view-trend";

describe("trend days", () => {
  it("ends on the UTC day and crosses a month boundary", () => {
    const days = trendDays(new Date("2026-03-01T15:00:00.000Z"));
    assert.equal(days.length, 30);
    assert.equal(days[0], "20260131");
    assert.equal(days[29], "20260301");
  });
});

describe("fill trend", () => {
  it("keeps a zero for a day with no row", () => {
    const points = fillTrend(["20261018", "20261019"], [{ day: "20261019", count: 2 }]);
    assert.deepEqual(points, [
      { day: "20261018", count: 0 },
      { day: "20261019", count: 2 },
    ]);
  });
});

describe("trend summary", () => {
  it("names the single busiest day", () => {
    assert.equal(
      trendSummary([
        { day: "20261018", count: 1 },
        { day: "20261019", count: 4 },
      ]),
      "5 views in the last 30 days. Most on Oct 19 (4).",
    );
  });

  it("stays quiet when every day is empty or tied", () => {
    assert.equal(trendSummary([{ day: "20261019", count: 0 }]), "No views in the last 30 days.");
    assert.equal(
      trendSummary([
        { day: "20261018", count: 2 },
        { day: "20261019", count: 2 },
      ]),
      "4 views in the last 30 days.",
    );
  });
});

describe("helpful ratio", () => {
  it("rounds the share of helpful votes", () => {
    assert.equal(helpfulRatioLabel(0, 0), "No votes yet.");
    assert.equal(helpfulRatioLabel(3, 1), "75% helpful · 3 of 4");
  });
});

describe("sparkline", () => {
  it("puts the peak on the top edge and zero on the bottom", () => {
    assert.equal(sparklinePoints([0, 4], 10, 8), "0,8 10,0");
  });
});
