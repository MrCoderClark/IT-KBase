/**
 * Duplicate / overlap check (spec 20 §3.2 B5). Pure helpers shared by the
 * server action and its tests. The FTS query reuses the same lexical signal as
 * related articles — title, tag names, and a short summary — so "overlaps with
 * this draft" stays consistent with how relatedness is computed elsewhere.
 */

import { relatedSearchText } from "@/lib/kb/related";

export interface DuplicateMatch {
  slug: string;
  title: string;
  categoryName: string | null;
}

export interface DuplicateQuery {
  title: string;
  summary: string;
  tagNames: string[];
}

/** FTS query text for the overlap check, or null when there is too little signal. */
export function draftSearchText(input: DuplicateQuery): string | null {
  return relatedSearchText({
    title: input.title,
    summary: input.summary,
    tags: input.tagNames.map((name) => ({ name })),
  });
}
