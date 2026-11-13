"use client";

/**
 * "Draft an update" review (spec 20 §3.3 C3). Sends the serialized draft to the
 * copilot, which refreshes it to current practice and addresses the flagged
 * dated references, and shows the result as an accept-only review. Nothing
 * changes until the author clicks Apply; the article's taxonomy is preserved.
 */

import { useEffect, useState } from "react";
import { Check, Loader2, RefreshCw } from "lucide-react";
import { ArticleContent } from "@/components/kb/article-content";
import type { OutdatedMatch } from "@/lib/assistant/staleness";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { draftToArticle } from "@/lib/editor/draft-to-article";
import { parsedToDraft, type ParsedDraft } from "@/lib/ingestion/to-draft";

type Taxonomy = { name: string; slug: string }[];

export function UpdateReviewDialog({
  open,
  content,
  authorName,
  categories,
  tags,
  currentCategorySlug,
  currentTagSlugs,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  content: string;
  authorName: string;
  categories: Taxonomy;
  tags: Taxonomy;
  currentCategorySlug: string | null;
  currentTagSlugs: string[];
  onOpenChange: (open: boolean) => void;
  onApply: (draft: ParsedDraft) => void;
}) {
  const [draft, setDraft] = useState<ParsedDraft | null>(null);
  const [outdated, setOutdated] = useState<OutdatedMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      // Reset so reopening re-runs against the (possibly edited) draft.
      setDraft(null);
      setOutdated([]);
      setError(null);
      setBusy(false);
      return;
    }
    let active = true;
    setBusy(true);
    setError(null);
    (async () => {
      try {
        const response = await fetch("/api/assistant/update-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        const data = (await response.json()) as {
          draft?: ParsedDraft;
          outdated?: OutdatedMatch[];
          error?: string;
        };
        if (!active) return;
        if (!response.ok || !data.draft) {
          setError(data.error ?? "The assistant could not draft an update.");
          return;
        }
        setDraft(data.draft);
        setOutdated(data.outdated ?? []);
      } catch {
        if (active) setError("The assistant is unreachable. Try again.");
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, content]);

  const previewArticle =
    draft &&
    draftToArticle(
      {
        ...parsedToDraft(draft),
        slug: null,
        version: null,
        status: "draft",
        visibility: "private",
        categorySlug: currentCategorySlug,
        tagSlugs: currentTagSlugs,
        parentId: null,
      },
      { authorName, categories, tags },
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex h-[min(92vh,900px)] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1000px]"
      >
        <DialogHeader className="shrink-0 border-b border-border px-5 py-3 pr-12">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-semibold">
            <RefreshCw size={16} className="text-accent" aria-hidden />
            Draft an update
          </DialogTitle>
          <DialogDescription>
            The copilot refreshes dated references to current practice. Nothing changes until you apply it.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-canvas px-5 py-5">
          {busy ? (
            <div className="flex items-center gap-2 text-[13px] text-fg-muted">
              <Loader2 size={16} className="animate-spin" aria-hidden />
              Drafting an update…
            </div>
          ) : error ? (
            <p className="text-[13px] font-medium text-warning" role="alert">
              {error}
            </p>
          ) : draft && previewArticle ? (
            <>
              {outdated.length > 0 ? (
                <div className="mb-4 rounded-lg border border-accent/25 bg-accent-soft px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold text-fg">
                    <Check size={13} className="text-accent" aria-hidden />
                    Addressed {outdated.length} dated{" "}
                    {outdated.length === 1 ? "reference" : "references"}
                  </p>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[12px] leading-5 text-fg-muted">
                    {outdated.map((match) => (
                      <li key={match.id}>
                        <span className="font-medium text-fg">{match.label}:</span> {match.suggest}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {draft.summary ? (
                <div className="mb-4 rounded-lg border border-accent/25 bg-accent-soft px-3 py-2.5">
                  <p className="text-[12px] leading-4 text-fg">
                    <span className="font-medium">Summary:</span> {draft.summary}
                  </p>
                </div>
              ) : null}
              <h2 className="mb-3 text-[20px] font-bold tracking-tight text-fg">
                {previewArticle.title}
              </h2>
              <ArticleContent article={previewArticle} />
            </>
          ) : null}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!draft || busy}
            onClick={() => {
              if (draft) onApply(draft);
              onOpenChange(false);
            }}
          >
            Apply update
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
