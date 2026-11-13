"use client";

/**
 * "Summarize feedback" (spec 20 §3.3 C4). A reviewer-only, on-demand digest of
 * an article's not-helpful comments into themes and suggested edits.
 * Informational only — it changes nothing. The BFF collects the comments
 * server-side; this just asks for the digest.
 */

import { useState } from "react";
import { Loader2, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";

type Digest = { summary: string; themes: string[]; suggestions: string[] };

export function FeedbackDigestCard({ articleId }: { articleId: string }) {
  const [result, setResult] = useState<Digest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function summarize() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/assistant/feedback-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId }),
      });
      const data = (await response.json()) as Digest & { error?: string };
      if (!response.ok) {
        setError(data.error ?? "The assistant could not digest this feedback.");
        return;
      }
      setResult({
        summary: data.summary ?? "",
        themes: data.themes ?? [],
        suggestions: data.suggestions ?? [],
      });
    } catch {
      setError("The assistant is unreachable. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-3 rounded-xl border border-accent/25 bg-accent-soft px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-accent">
          <MessageSquareText size={14} aria-hidden />
          Digest the not-helpful feedback
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
            "Summarize feedback"
          )}
        </Button>
      </div>

      {error ? (
        <p className="mt-2 text-[12px] font-medium text-warning" role="alert">
          {error}
        </p>
      ) : result ? (
        <div className="mt-2 space-y-2 text-[12px] leading-5">
          {result.summary ? <p className="text-fg">{result.summary}</p> : null}
          {result.themes.length > 0 ? (
            <div>
              <p className="font-semibold text-fg">Themes</p>
              <ul className="mt-0.5 list-disc space-y-0.5 pl-5 text-fg-muted">
                {result.themes.map((theme, index) => (
                  <li key={index}>{theme}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {result.suggestions.length > 0 ? (
            <div>
              <p className="font-semibold text-fg">Suggested edits</p>
              <ul className="mt-0.5 list-disc space-y-0.5 pl-5 text-fg-muted">
                {result.suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-1 text-[12px] text-fg-muted">
          Clusters the not-helpful comments below into themes and concrete edits — from the comments only.
        </p>
      )}
    </div>
  );
}
