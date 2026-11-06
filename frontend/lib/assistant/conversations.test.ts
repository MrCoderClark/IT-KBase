import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clampLimit, DEFAULT_LIMIT, MAX_LIMIT, paginateById } from "./conversations";

describe("clampLimit", () => {
  it("defaults when absent or non-numeric", () => {
    assert.equal(clampLimit(undefined), DEFAULT_LIMIT);
    assert.equal(clampLimit(Number.NaN), DEFAULT_LIMIT);
  });

  it("floors at 1 and caps at MAX_LIMIT, truncating fractions", () => {
    assert.equal(clampLimit(0), 1);
    assert.equal(clampLimit(-5), 1);
    assert.equal(clampLimit(10.9), 10);
    assert.equal(clampLimit(MAX_LIMIT + 100), MAX_LIMIT);
  });
});

describe("paginateById", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("returns all rows and no cursor when the page is not full", () => {
    const { page, nextCursor } = paginateById(rows, 5);
    assert.deepEqual(page, rows);
    assert.equal(nextCursor, null);
  });

  it("returns all rows and no cursor when exactly full (no over-fetch)", () => {
    const { page, nextCursor } = paginateById(rows, 3);
    assert.deepEqual(page, rows);
    assert.equal(nextCursor, null);
  });

  it("drops the over-fetched row and points the cursor at the last kept id", () => {
    const { page, nextCursor } = paginateById(rows, 2);
    assert.deepEqual(page, [{ id: "a" }, { id: "b" }]);
    assert.equal(nextCursor, "b");
  });
});
