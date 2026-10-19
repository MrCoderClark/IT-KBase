import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { latestRecentArticles, type RecentTouch } from "./recent-articles";

function touch(slug: string, at: string, title = slug): RecentTouch {
  return { slug, title, status: "published", category: "Windows", at };
}

describe("recent articles", () => {
  it("keeps the later open or edit of the same article", () => {
    const rows = latestRecentArticles([
      touch("bitlocker", "2026-10-14T12:00:00.000Z", "BitLocker"),
      touch("bitlocker", "2026-10-19T15:00:00.000Z", "BitLocker"),
      touch("dns", "2026-10-18T12:00:00.000Z", "Flush DNS"),
    ]);
    assert.deepEqual(
      rows.map((row) => row.slug),
      ["bitlocker", "dns"],
    );
  });

  it("returns at most ten, newest first", () => {
    const touches = Array.from({ length: 12 }, (_, index) =>
      touch(`article-${index}`, `2026-10-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`),
    );
    const rows = latestRecentArticles(touches);
    assert.equal(rows.length, 10);
    assert.equal(rows[0]?.slug, "article-11");
    assert.equal(rows[9]?.slug, "article-2");
  });
});
