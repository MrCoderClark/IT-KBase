"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteArticle } from "@/lib/actions/delete-article";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DeleteArticleButton({
  articleId,
  title,
  compact = false,
}: {
  articleId: string;
  title: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const message = await deleteArticle(articleId);
      if (message) setError(message);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={compact ? "ghost" : "outline"}
        size={compact ? "sm" : "default"}
        className={
          compact
            ? "h-6 shrink-0 px-1.5 text-[12px] text-danger-fg hover:text-danger-fg"
            : "text-danger-fg hover:text-danger-fg"
        }
        onClick={() => setOpen(true)}
      >
        <Trash2 size={compact ? 12 : 14} aria-hidden />
        Delete
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this article?</DialogTitle>
            <DialogDescription>
              {title} is removed, including its versions, notes, and votes. If it still has child
              pages, move or delete those first. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error ? <p className="text-[13px] text-danger">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirm} disabled={pending}>
              {pending ? "Deleting…" : "Delete article"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
