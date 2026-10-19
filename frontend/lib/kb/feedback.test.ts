import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { feedbackComment, feedbackIsCooling, feedbackOpenAgain } from "./feedback";

describe("feedback comment", () => {
  it("keeps an empty comment and refuses one past 500 characters", () => {
    assert.deepEqual(feedbackComment("  "), { ok: true, comment: null });
    assert.deepEqual(feedbackComment("The flush step worked."), {
      ok: true,
      comment: "The flush step worked.",
    });
    assert.deepEqual(feedbackComment("a".repeat(501)), { ok: false });
  });
});

describe("feedback cooldown", () => {
  it("blocks another vote for seven days", () => {
    const voted = new Date("2026-10-12T15:00:00.000Z");
    const soon = new Date("2026-10-18T14:00:00.000Z");
    const later = new Date("2026-10-19T15:00:00.000Z");
    assert.equal(feedbackIsCooling(voted, soon), true);
    assert.equal(feedbackIsCooling(voted, later), false);
    assert.equal(feedbackOpenAgain(voted).toISOString(), "2026-10-19T15:00:00.000Z");
  });
});
