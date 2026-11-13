"use client";

/**
 * "Cluster gaps into themes" (spec 20 §3.3 C5). A reviewer-only, on-demand
 * grouping of the open coverage gaps into topics ranked by demand — "14 asks
 * about MFA re-registration" rather than a flat list of near-duplicate questions.
 * Informational only. The BFF collects the gaps and sums the demand server-side;
 * this just asks for the clustering.
 */

import { useState } from "react";
import { Boxes, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GapCluster } from "@/lib/assistant/coverage";

export function GapClusters() {
  const [clusters, setClusters] = useState<GapCluster[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/assistant/cluster-gaps", { method: "POST" });
      const data = (await response.json()) as { clusters?: GapCluster[]; error?: string };
      if (!response.ok) {
        setError(data.error ?? "The assistant could not cluster the gaps.");
        return;
      }
      setClusters(data.clusters ?? []);
    } catch {
      setError("The assistant is unreachable. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-accent/25 bg-accent-soft px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-accent">
          <Boxes size={14} aria-hidden />
          Cluster gaps into themes
        </p>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={run}>
          {busy ? (
            <>
              <Loader2 size={14} className="animate-spin" aria-hidden />
              Clustering…
            </>
          ) : clusters ? (
            "Cluster again"
          ) : (
            "Cluster gaps"
          )}
        </Button>
      </div>

      {error ? (
        <p className="mt-2 text-[12px] font-medium text-warning" role="alert">
          {error}
        </p>
      ) : clusters ? (
        clusters.length === 0 ? (
          <p className="mt-2 text-[12px] text-fg-muted">
            No themes stood out — the open gaps don&apos;t group into topics.
          </p>
        ) : (
          <ol className="mt-2 flex flex-col gap-2">
            {clusters.map((cluster, index) => (
              <li key={index} className="rounded-lg border border-border bg-surface px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[13px] font-semibold text-fg">{cluster.label}</p>
                  <span className="shrink-0 rounded-xs bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent tabular-nums">
                    {cluster.askCount} {cluster.askCount === 1 ? "ask" : "asks"} ·{" "}
                    {cluster.gapCount} {cluster.gapCount === 1 ? "gap" : "gaps"}
                  </span>
                </div>
                {cluster.theme ? (
                  <p className="mt-0.5 text-[12px] text-fg-muted">{cluster.theme}</p>
                ) : null}
                {cluster.questions.length > 0 ? (
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[12px] leading-5 text-fg-subtle">
                    {cluster.questions.map((question, qIndex) => (
                      <li key={qIndex}>{question}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        )
      ) : (
        <p className="mt-1 text-[12px] text-fg-muted">
          Groups the open gaps below into topics ranked by demand — from the logged questions only.
        </p>
      )}
    </div>
  );
}
