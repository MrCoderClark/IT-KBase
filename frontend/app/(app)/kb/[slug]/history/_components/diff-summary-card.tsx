"use client";

/**
 * "Summarize changes" (spec 20 §3.3 C1). A reviewer-only, on-demand plain-English
 * summary of what changed between two versions. Informational only — it changes
 * nothing. The BFF computes the section diff server-side; this just asks for it.
 */

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type Summary = { summary: string; changes: string[] };

export function DiffSummaryCard({
  slug,
  fromVersion,
  toVersion,
}: {
  slug: string;
  fromVersion: string;
  toVersion: string;
}) {
  const [result, setResult] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function summarize() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/assistant/diff-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, from: fromVersion, to: toVersion }),
      });
      const data = (await response.json()) as Summary & { error?: string };
      if (!response.ok) {
        setError(data.error ?? "The assistant could not summarize these changes.");
        return;
      }
      setResult({ summary: data.summary ?? "", changes: data.changes ?? [] });
    } catch {
      setError("The assistant is unreachable. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-accent/25 bg-accent-soft px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-accent">
          <Sparkles size={14} aria-hidden />
          What changed, in plain English
        </p>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={summarize}>
          {busy ? (
            <>
              <Loader2 size={14} className="animate-spin" aria-hidden />
              Summarizing…
            </>
          ) : result ? (
            "Summarize again"
          ) : (
            "Summarize changes"
          )}
        </Button>
      </div>

      {error ? (
        <p className="mt-2 text-[12px] font-medium text-warning" role="alert">
          {error}
        </p>
      ) : result ? (
        <div className="mt-2 space-y-2">
          {result.summary ? <p className="text-[13px] leading-5 text-fg">{result.summary}</p> : null}
          {result.changes.length > 0 ? (
            <ul className="list-disc space-y-0.5 pl-5 text-[12px] leading-5 text-fg-muted">
              {result.changes.map((change, index) => (
                <li key={index}>{change}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="mt-1 text-[12px] text-fg-muted">
          A grounded recap of the differences below — commands and facts come only from the diff.
        </p>
      )}
    </div>
  );
}
