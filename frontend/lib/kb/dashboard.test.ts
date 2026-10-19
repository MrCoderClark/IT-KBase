import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countStatuses, opensSince, staleCutoff, windowStartDay } from "./dashboard";

describe("dashboard windows", () => {
  it("starts a 7-day window six UTC days before today", () => {
    assert.equal(windowStartDay(new Date("2026-10-19T18:00:00.000Z"), 7), "20261013");
    assert.equal(staleCutoff(new Date("2026-10-19T18:00:00.000Z")).toISOString(), "2025-10-19T00:00:00.000Z");
  });
});

describe("status counts", () => {
  it("adds every status into the total", () => {
    assert.deepEqual(
      countStatuses([
        { status: "published", count: 9 },
        { status: "draft", count: 2 },
        { status: "in_review", count: 1 },
      ]),
      { total: 12, published: 9, inReview: 1, draft: 2, archived: 0 },
    );
  });
});

describe("opens since", () => {
  it("counts only days inside the window", () => {
    const rows = [
      { day: "20261012", count: 3 },
      { day: "20261013", count: 1 },
      { day: "20261019", count: 4 },
    ];
    assert.equal(opensSince(rows, "20261013"), 5);
    assert.equal(opensSince(rows, "20261012"), 8);
  });
});
