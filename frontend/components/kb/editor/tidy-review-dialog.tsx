"use client";

/**
 * "Tidy this draft" review (spec 20 §3.2 B3). Sends the serialized draft to the
 * copilot and shows the tidied result — rewritten sections, a proposed summary,
 * and a category/tags proposal from existing taxonomy — as an accept-only review.
 * Nothing changes until the author clicks Apply.
 */

import { useEffect, useState } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { ArticleContent } from "@/components/kb/article-content";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { draftToArticle } from "@/lib/editor/draft-to-article";
import { parsedToDraft } from "@/lib/ingestion/to-draft";
import type { TidyResult } from "@/lib/assistant/tidy-client";

type Taxonomy = { name: string; slug: string }[];

export function TidyReviewDialog({
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
  onApply: (result: TidyResult) => void;
}) {
  const [result, setResult] = useState<TidyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      // Reset so reopening re-tidies the (possibly edited) draft.
      setResult(null);
      setError(null);
      setBusy(false);
      return;
    }
    let active = true;
    setBusy(true);
    setError(null);
    (async () => {
      try {
        const response = await fetch("/api/assistant/tidy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        const data = (await response.json()) as (TidyResult & { error?: string });
        if (!active) return;
        if (!response.ok || !data.draft) {
          setError(data.error ?? "The assistant could not tidy this draft.");
          return;
        }
        setResult({
          draft: data.draft,
          categorySlug: data.categorySlug ?? null,
          tagSlugs: data.tagSlugs ?? [],
        });
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

  const tidiedCategorySlug = result?.categorySlug ?? currentCategorySlug;
  const tidiedTagSlugs = result && result.tagSlugs.length > 0 ? result.tagSlugs : currentTagSlugs;

  const previewArticle =
    result &&
    draftToArticle(
      {
        ...parsedToDraft(result.draft),
        slug: null,
        version: null,
        status: "draft",
        visibility: "private",
        categorySlug: tidiedCategorySlug,
        tagSlugs: tidiedTagSlugs,
        parentId: null,
      },
      { authorName, categories, tags },
    );

  const nameFor = (list: Taxonomy, slug: string | null) =>
    slug ? (list.find((item) => item.slug === slug)?.name ?? slug) : null;
  const categoryName = nameFor(categories, result?.categorySlug ?? null);
  const proposedTagNames = (result?.tagSlugs ?? []).map((slug) => nameFor(tags, slug) ?? slug);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex h-[min(92vh,900px)] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1000px]"
      >
        <DialogHeader className="shrink-0 border-b border-border px-5 py-3 pr-12">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-semibold">
            <Wand2 size={16} className="text-accent" aria-hidden />
            Tidy this draft
          </DialogTitle>
          <DialogDescription>
            Review the copilot&apos;s rewrite. Nothing changes until you apply it.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-canvas px-5 py-5">
          {busy ? (
            <div className="flex items-center gap-2 text-[13px] text-fg-muted">
              <Loader2 size={16} className="animate-spin" aria-hidden />
              Tidying your draft…
            </div>
          ) : error ? (
            <p className="text-[13px] font-medium text-warning" role="alert">
              {error}
            </p>
          ) : result && previewArticle ? (
            <>
              <div className="mb-4 space-y-2 rounded-lg border border-accent/25 bg-accent-soft px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-[12px] font-semibold text-accent">
                  <Sparkles size={13} aria-hidden /> Proposed changes
                </p>
                {result.draft.summary ? (
                  <p className="text-[12px] leading-4 text-fg">
                    <span className="font-medium">Summary:</span> {result.draft.summary}
                  </p>
                ) : null}
                <p className="text-[12px] leading-4 text-fg">
                  <span className="font-medium">Category:</span>{" "}
                  {categoryName ?? <span className="text-fg-subtle">no change</span>}
                </p>
                <p className="flex flex-wrap items-center gap-1 text-[12px] leading-4 text-fg">
                  <span className="font-medium">Tags:</span>{" "}
                  {proposedTagNames.length > 0 ? (
                    proposedTagNames.map((name) => (
                      <span
                        key={name}
                        className="rounded-xs bg-surface px-1.5 py-0.5 text-[11px] font-semibold text-accent"
                      >
                        {name}
                      </span>
                    ))
                  ) : (
                    <span className="text-fg-subtle">no change</span>
                  )}
                </p>
              </div>

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
            disabled={!result || busy}
            onClick={() => {
              if (result) onApply(result);
              onOpenChange(false);
            }}
          >
            Apply tidied draft
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
