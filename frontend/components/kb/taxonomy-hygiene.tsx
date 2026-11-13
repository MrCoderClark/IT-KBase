/**
 * Taxonomy hygiene panel (spec 20 §3.3 C6) for the admin taxonomy page. Lists
 * tags that look like the same term written differently, or a typo apart, with
 * the most-used member named as the canonical to keep. Read-only — an admin
 * applies a merge from the tag tools; the assistant never edits taxonomy.
 */

import { ArrowRight, Tags } from "lucide-react";
import type { MergeSuggestion } from "@/lib/assistant/taxonomy";

export function TaxonomyHygiene({ suggestions }: { suggestions: MergeSuggestion[] }) {
  if (suggestions.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-surface px-4 py-3 text-[13px] text-fg-muted">
        No duplicate tags found. Every tag looks distinct.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {suggestions.map((suggestion) => (
        <li
          key={suggestion.canonical.slug}
          className="rounded-xl border border-border bg-surface px-4 py-3"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-[13px] text-fg">
              <Tags size={15} className="shrink-0 text-fg-muted" aria-hidden />
              Merge {suggestion.duplicates.length} {suggestion.duplicates.length === 1 ? "tag" : "tags"} into this one
            </p>
            <span className="shrink-0 rounded-xs border border-border px-1.5 py-0.5 text-[11px] font-medium text-fg-subtle">
              {suggestion.reason}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
            {suggestion.duplicates.map((dup) => (
              <span
                key={dup.slug}
                className="rounded-xs border border-border px-1.5 py-0.5 text-fg-muted line-through"
              >
                {dup.name} <span className="tabular-nums">({dup.count})</span>
              </span>
            ))}
            <ArrowRight size={13} className="text-fg-subtle" aria-hidden />
            <span className="rounded-xs bg-accent-soft px-1.5 py-0.5 font-semibold text-accent">
              {suggestion.canonical.name}{" "}
              <span className="tabular-nums">({suggestion.canonical.count})</span>
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
