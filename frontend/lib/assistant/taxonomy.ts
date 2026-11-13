/**
 * Taxonomy hygiene (spec 20 §3.3 C6), deterministic core. Pure functions over
 * the tag list + usage counts — no model call, no backend. `tagMergeSuggestions`
 * clusters tags that are the same term written differently ("Windows 11",
 * "windows-11", "Windows11") or a one-character typo apart, and names the
 * highest-use member as the canonical to merge into. Suggestions only — an admin
 * applies a merge; the assistant never edits taxonomy.
 *
 * Miscategorized-article detection (the LLM half of C6) shipped separately as
 * `review.py` `find_miscategorized` → `MiscategorizedReview` on this same page.
 */

export interface TagUsage {
  name: string;
  slug: string;
  /** Articles carrying this tag. */
  count: number;
}

export interface MergeSuggestion {
  /** The tag to keep — the most-used member. */
  canonical: TagUsage;
  /** The tags to fold into it. */
  duplicates: TagUsage[];
  reason: "same form" | "near-duplicate";
}

const MIN_NEAR_LEN = 5;

/** Lowercased, alphanumeric-only key: collapses case, spaces, and punctuation. */
export function normalizeTerm(term: string): string {
  return term.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Full Levenshtein distance between two short strings. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const rows = a.length + 1;
  const cols = b.length + 1;
  let prev = Array.from({ length: cols }, (_, i) => i);
  let curr = new Array<number>(cols);
  for (let i = 1; i < rows; i++) {
    curr[0] = i;
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[cols - 1];
}

/**
 * Two keys are near-duplicates when they are one edit apart and neither carries
 * a digit — so a typo like "kubernates"/"kubernetes" merges, but version tags
 * that differ only by a digit ("windows10"/"windows11") stay separate.
 */
function isNearDuplicate(a: string, b: string): boolean {
  if (a.length < MIN_NEAR_LEN || b.length < MIN_NEAR_LEN) return false;
  if (/\d/.test(a) || /\d/.test(b)) return false;
  return editDistance(a, b) === 1;
}

/** Keep the most-used tag; tie-break by longer name, then alphabetical. */
function pickCanonical(tags: TagUsage[]): TagUsage {
  return [...tags].sort(
    (a, b) =>
      b.count - a.count || b.name.length - a.name.length || a.name.localeCompare(b.name),
  )[0];
}

export function tagMergeSuggestions(tags: TagUsage[]): MergeSuggestion[] {
  const keys = tags.map((tag) => normalizeTerm(tag.name));

  // Union-find over tag indices.
  const parent = tags.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (i: number, j: number) => {
    parent[find(i)] = find(j);
  };

  for (let i = 0; i < tags.length; i++) {
    for (let j = i + 1; j < tags.length; j++) {
      if (!keys[i] || !keys[j]) continue;
      if (keys[i] === keys[j] || isNearDuplicate(keys[i], keys[j])) union(i, j);
    }
  }

  const clusters = new Map<number, number[]>();
  for (let i = 0; i < tags.length; i++) {
    const root = find(i);
    const list = clusters.get(root);
    if (list) list.push(i);
    else clusters.set(root, [i]);
  }

  const suggestions: MergeSuggestion[] = [];
  for (const members of clusters.values()) {
    if (members.length < 2) continue;
    const group = members.map((i) => tags[i]);
    const canonical = pickCanonical(group);
    const duplicates = group.filter((tag) => tag !== canonical);
    const distinctKeys = new Set(members.map((i) => keys[i]));
    suggestions.push({
      canonical,
      duplicates,
      reason: distinctKeys.size === 1 ? "same form" : "near-duplicate",
    });
  }

  // Biggest impact first: most tags folded, then most articles affected.
  return suggestions.sort(
    (a, b) =>
      b.duplicates.length - a.duplicates.length ||
      sumCount(b) - sumCount(a) ||
      a.canonical.name.localeCompare(b.canonical.name),
  );
}

function sumCount(suggestion: MergeSuggestion): number {
  return (
    suggestion.canonical.count +
    suggestion.duplicates.reduce((total, tag) => total + tag.count, 0)
  );
}
