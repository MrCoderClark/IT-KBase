import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  editDistance,
  normalizeTerm,
  tagMergeSuggestions,
  type TagUsage,
} from "./taxonomy";

const tag = (name: string, slug: string, count: number): TagUsage => ({ name, slug, count });

describe("normalizeTerm", () => {
  it("collapses case, spaces, and punctuation to an alphanumeric key", () => {
    assert.equal(normalizeTerm("Windows 11"), "windows11");
    assert.equal(normalizeTerm("windows-11"), "windows11");
    assert.equal(normalizeTerm("Windows11"), "windows11");
  });
});

describe("editDistance", () => {
  it("counts single edits", () => {
    assert.equal(editDistance("kubernetes", "kubernates"), 1);
    assert.equal(editDistance("same", "same"), 0);
    assert.equal(editDistance("abc", "abd"), 1);
  });
});

describe("tagMergeSuggestions", () => {
  it("groups the same term written differently and keeps the most-used as canonical", () => {
    const suggestions = tagMergeSuggestions([
      tag("Windows 11", "windows-11", 3),
      tag("windows-11", "windows-11-2", 9),
      tag("Windows11", "windows11", 1),
    ]);
    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0].reason, "same form");
    assert.equal(suggestions[0].canonical.slug, "windows-11-2"); // highest count (9)
    assert.equal(suggestions[0].duplicates.length, 2);
  });

  it("merges a one-letter typo but not version tags that differ by a digit", () => {
    const suggestions = tagMergeSuggestions([
      tag("Kubernetes", "kubernetes", 12),
      tag("Kubernates", "kubernates", 1),
      tag("Windows 10", "windows-10", 5),
      tag("Windows 11", "windows-11", 7),
    ]);
    // Only the typo pair clusters; Windows 10 vs 11 stay separate.
    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0].reason, "near-duplicate");
    assert.equal(suggestions[0].canonical.slug, "kubernetes");
    assert.deepEqual(
      suggestions[0].duplicates.map((t) => t.slug),
      ["kubernates"],
    );
  });

  it("returns nothing when every tag is distinct", () => {
    assert.deepEqual(
      tagMergeSuggestions([tag("Windows", "windows", 4), tag("Linux", "linux", 6)]),
      [],
    );
  });

  it("does not merge short tags on a single edit", () => {
    // "ad" vs "ap" are a single edit apart but below the near-duplicate length floor.
    assert.deepEqual(tagMergeSuggestions([tag("AD", "ad", 3), tag("AP", "ap", 2)]), []);
  });

  it("orders suggestions by how many tags each folds", () => {
    const suggestions = tagMergeSuggestions([
      tag("Entra ID", "entra-id", 5),
      tag("entra-id", "entra-id-2", 2),
      tag("M365", "m365", 8),
      tag("m-365", "m-365-2", 1),
      tag("m 365", "m-365-3", 1),
    ]);
    assert.equal(suggestions.length, 2);
    assert.equal(suggestions[0].duplicates.length, 2); // the three-way M365 cluster first
    assert.equal(suggestions[1].duplicates.length, 1);
  });
});
