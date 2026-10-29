import assert from "node:assert/strict";
import { describe, it } from "node:test";

/** Pure selection used by the job — kept testable without a DB. */
export function selectExpiredVersionIds(input: {
  now: Date;
  retentionDays: number;
  versions: Array<{ id: string; createdAt: Date }>;
  protectedIds: string[];
}): string[] {
  const cutoff = new Date(input.now.getTime() - input.retentionDays * 24 * 60 * 60 * 1000);
  const protectedSet = new Set(input.protectedIds);
  return input.versions
    .filter((row) => row.createdAt < cutoff && !protectedSet.has(row.id))
    .map((row) => row.id);
}

describe("selectExpiredVersionIds", () => {
  const now = new Date("2026-10-29T12:00:00Z");

  it("keeps versions inside the retention window", () => {
    const ids = selectExpiredVersionIds({
      now,
      retentionDays: 30,
      protectedIds: [],
      versions: [
        { id: "new", createdAt: new Date("2026-10-20T00:00:00Z") },
        { id: "old", createdAt: new Date("2026-08-01T00:00:00Z") },
      ],
    });
    assert.deepEqual(ids, ["old"]);
  });

  it("never selects current or draft pointers", () => {
    const ids = selectExpiredVersionIds({
      now,
      retentionDays: 30,
      protectedIds: ["current", "draft"],
      versions: [
        { id: "current", createdAt: new Date("2025-01-01T00:00:00Z") },
        { id: "draft", createdAt: new Date("2025-01-01T00:00:00Z") },
        { id: "stale", createdAt: new Date("2025-01-01T00:00:00Z") },
      ],
    });
    assert.deepEqual(ids, ["stale"]);
  });
});
