"use client";

import { Eye } from "lucide-react";
import { ArticleContent } from "@/components/kb/article-content";
import { ArticleHeader } from "@/components/kb/article-header";
import { ArticleToc } from "@/components/kb/article-toc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { draftToArticle } from "@/lib/editor/draft-to-article";
import type { EditorDraft } from "@/lib/editor/draft";

export function PreviewDialog({
  draft,
  open,
  onOpenChange,
  authorName,
  categories,
  tags,
}: {
  draft: EditorDraft;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authorName: string;
  categories: { name: string; slug: string }[];
  tags: { name: string; slug: string }[];
}) {
  const article = draftToArticle(draft, { authorName, categories, tags });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex h-[min(92vh,900px)] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1100px]"
      >
        <DialogHeader className="shrink-0 border-b border-border px-5 py-3 pr-12">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-semibold">
            <Eye size={16} className="text-accent" aria-hidden />
            Reader preview
          </DialogTitle>
          <DialogDescription>
            How this article looks on the knowledge base page. Nothing is published from here.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-canvas px-5 py-5">
          <div className="mb-4 rounded-lg border border-accent/25 bg-accent-soft px-3 py-2 text-[12px] font-medium text-accent">
            Preview only — status stays {article.status.replace("_", " ")}. Close to keep editing.
          </div>
          <ArticleHeader article={article} showActions={false} />
          <div className="mt-8 flex items-start gap-6">
            {article.sections.length > 0 ? (
              <ArticleToc sections={article.sections} />
            ) : null}
            <div className="min-w-0 flex-1">
              {article.sections.some((section) => section.blocks.length > 0) ? (
                <ArticleContent article={article} />
              ) : (
                <p className="text-[14px] text-fg-subtle">
                  No section content yet. Add overview text or steps, then open preview again.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 justify-end border-t border-border px-5 py-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Back to editor
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
