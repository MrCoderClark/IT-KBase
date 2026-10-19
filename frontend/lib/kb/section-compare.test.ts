import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareSections, sectionPlainText } from "./section-compare";
import type { Section } from "@/lib/types/article";

function section(order: number, title: string, content: string): Section {
  return {
    id: `s-${order}-${title}`,
    kind: "custom",
    title,
    order,
    blocks: [{ id: `b-${order}`, kind: "prose", order: 0, content }],
  };
}

describe("section plain text", () => {
  it("drops tags so the same words compare equal", () => {
    const html = section(0, "Overview", "<p>Lock the drive.</p>");
    const plain = section(0, "Overview", "Lock the drive.");
    assert.equal(sectionPlainText(html), sectionPlainText(plain));
  });
});

describe("compare sections", () => {
  it("marks a matching pair unchanged and a rewritten pair changed", () => {
    const rows = compareSections(
      [section(0, "Overview", "Current text"), section(1, "Steps", "Same")],
      [section(0, "Overview", "Older text"), section(1, "Steps", "Same")],
    );
    assert.equal(rows[0]?.status, "changed");
    assert.equal(rows[1]?.status, "unchanged");
  });

  it("marks a section that exists on only one side", () => {
    const rows = compareSections(
      [section(0, "Overview", "A"), section(1, "Verify", "B")],
      [section(0, "Overview", "A")],
    );
    assert.equal(rows[0]?.status, "unchanged");
    assert.equal(rows[1]?.status, "only-left");
    assert.equal(rows[1]?.right, null);
  });

  it("pairs by order, so an inserted section shifts the ones after it", () => {
    const rows = compareSections(
      [section(0, "Intro", "New"), section(1, "Overview", "Body")],
      [section(0, "Overview", "Body")],
    );
    assert.equal(rows[0]?.status, "changed");
    assert.equal(rows[1]?.status, "only-left");
    assert.equal(rows[1]?.left?.title, "Overview");
  });
});
