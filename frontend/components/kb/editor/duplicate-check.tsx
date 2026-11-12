"use client";

/**
 * Overlap check (spec 20 §3.2 B5). On demand, runs FTS from the current draft
 * over readable published articles and lists likely duplicates to link or merge.
 * Manual trigger — the draft changes constantly, so we don't want a query per
 * keystroke; this is the "before submit-for-review" nudge.
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Layers } from "lucide-react";
import { checkDuplicates, type DuplicateResult } from "@/lib/actions/check-duplicates";

export function DuplicateCheck({
  title,
  summary,
  tagNames,
  excludeSlug,
}: {
  title: string;
  summary: string;
  tagNames: string[];
  excludeSlug: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<DuplicateResult | null>(null);
  const canRun = title.trim().length > 1;

  function run() {
    // A fresh draft edit invalidates the last result.
    setResult(null);
    startTransition(async () => {
      setResult(await checkDuplicates({ title, summary, tagNames, excludeSlug }));
    });
  }

  return (
    <section aria-label="Overlap check" className="space-y-2 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[12px] font-semibold text-fg-muted">
          <Layers size={13} className="text-accent" aria-hidden />
          Overlap check
        </h2>
        <button
          type="button"
          onClick={run}
          disabled={!canRun || pending}
          className="inline-flex h-6 items-center gap-1 rounded-md border border-border px-2 text-[11px] font-semibold text-fg-muted hover:bg-surface-muted disabled:opacity-50"
        >
          {pending ? <Loader2 size={11} className="animate-spin" aria-hidden /> : null}
          {pending ? "Checking…" : "Check"}
        </button>
      </div>

      {!canRun ? (
        <p className="text-[12px] leading-4 text-fg-subtle">
          Add a title to check for overlapping articles.
        </p>
      ) : null}

      {result && !result.ok ? (
        <p className="text-[12px] font-medium text-warning" role="alert">
          {result.error}
        </p>
      ) : null}

      {result?.ok && !pending ? (
        result.matches.length === 0 ? (
          <p className="text-[12px] leading-4 text-fg-subtle">
            No published articles overlap with this draft.
          </p>
        ) : (
          <div className="space-y-1.5">
            <p className="text-[12px] leading-4 text-fg-muted">
              {result.matches.length} published{" "}
              {result.matches.length === 1 ? "article overlaps" : "articles overlap"} — consider
              linking or merging instead of duplicating:
            </p>
            <ul className="space-y-1.5">
              {result.matches.map((match) => (
                <li
                  key={match.slug}
                  className="rounded-lg border border-border bg-canvas px-2.5 py-1.5 text-[12px] leading-4"
                >
                  <Link
                    href={`/kb/${match.slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
                  >
                    {match.title}
                    <ExternalLink size={11} aria-hidden />
                  </Link>
                  {match.categoryName ? (
                    <span className="mt-0.5 block text-fg-subtle">{match.categoryName}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )
      ) : null}
    </section>
  );
}
