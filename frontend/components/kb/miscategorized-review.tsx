"use client";

/**
 * "Review categories" (spec 20 §3.3 C6). An admin-only, on-demand check that
 * flags published articles whose content fits a different category better than
 * their current one, with a suggested category and a confidence. Informational
 * only — an admin recategorizes from the article; the assistant never edits
 * taxonomy. The BFF assembles the input and validates the suggestions server-side.
 */

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, FolderTree, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Flag = {
  articleTitle: string;
  articleSlug: string;
  currentCategory: string;
  suggestedCategory: string;
  reason: string;
  confidence: string;
};

const CONFIDENCE_STYLE: Record<string, string> = {
  high: "border-warning/30 bg-warning-soft text-warning-fg",
  medium: "border-border bg-surface text-fg-muted",
  low: "border-border bg-surface text-fg-subtle",
};

export function MiscategorizedReview() {
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/assistant/miscategorized", { method: "POST" });
      const data = (await response.json()) as { flags?: Flag[]; error?: string };
      if (!response.ok) {
        setError(data.error ?? "The assistant could not review the categories.");
        return;
      }
      setFlags(data.flags ?? []);
    } catch {
      setError("The assistant is unreachable. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-fg">
          <FolderTree size={15} className="text-fg-muted" aria-hidden />
          Miscategorized articles
        </h2>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={run}>
          {busy ? (
            <>
              <Loader2 size={14} className="animate-spin" aria-hidden />
              Reviewing…
            </>
          ) : flags ? (
            "Review again"
          ) : (
            "Review categories"
          )}
        </Button>
      </div>
      <p className="mt-1 text-[12px] text-fg-muted">
        Published articles whose content looks closer to a different category, with a suggestion. The
        assistant only suggests — recategorize from the article.
      </p>

      {error ? (
        <p className="mt-3 text-[13px] font-medium text-warning" role="alert">
          {error}
        </p>
      ) : flags ? (
        flags.length === 0 ? (
          <p className="mt-3 rounded-lg border border-border bg-surface px-4 py-3 text-[13px] text-fg-muted">
            Nothing looks miscategorized. Every published article fits its category.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {flags.map((flag) => (
              <li
                key={flag.articleSlug}
                className="rounded-xl border border-border bg-surface px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/kb/${flag.articleSlug}`}
                    className="text-[14px] font-semibold text-fg hover:text-accent hover:underline"
                  >
                    {flag.articleTitle}
                  </Link>
                  <span
                    className={`shrink-0 rounded-xs border px-1.5 py-0.5 text-[11px] font-medium ${
                      CONFIDENCE_STYLE[flag.confidence] ?? CONFIDENCE_STYLE.low
                    }`}
                  >
                    {flag.confidence} confidence
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
                  <span className="rounded-xs border border-border px-1.5 py-0.5 text-fg-muted line-through">
                    {flag.currentCategory}
                  </span>
                  <ArrowRight size={13} className="text-fg-subtle" aria-hidden />
                  <span className="rounded-xs bg-accent-soft px-1.5 py-0.5 font-semibold text-accent">
                    {flag.suggestedCategory}
                  </span>
                </div>
                {flag.reason ? (
                  <p className="mt-1.5 text-[12px] leading-5 text-fg-muted">{flag.reason}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}
