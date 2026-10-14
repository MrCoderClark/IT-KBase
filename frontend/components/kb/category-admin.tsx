"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArticleListShell } from "@/components/kb/article-list-shell";
import {
  createCategory,
  deleteCategory,
  renameCategory,
} from "@/lib/actions/categories";

type CategoryRow = { name: string; slug: string; count: number };
type DialogMode =
  | { type: "create" }
  | { type: "rename"; category: CategoryRow }
  | { type: "delete"; category: CategoryRow };

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] leading-5 text-fg placeholder:text-fg-subtle/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30";

export function CategoryAdmin({
  categories,
  canManage,
}: {
  categories: CategoryRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<DialogMode | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setName("");
    setError(null);
    setMode({ type: "create" });
  }

  function openRename(category: CategoryRow) {
    setName(category.name);
    setError(null);
    setMode({ type: "rename", category });
  }

  function openDelete(category: CategoryRow) {
    setError(null);
    setMode({ type: "delete", category });
  }

  function close() {
    if (pending) return;
    setMode(null);
    setError(null);
  }

  function submitName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mode || mode.type === "delete") return;
    const nextName = name;
    const current = mode;
    startTransition(async () => {
      const result =
        current.type === "create"
          ? await createCategory(nextName)
          : await renameCategory(current.category.slug, nextName);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMode(null);
      router.refresh();
    });
  }

  function confirmDelete() {
    if (!mode || mode.type !== "delete") return;
    const slug = mode.category.slug;
    startTransition(async () => {
      const result = await deleteCategory(slug);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMode(null);
      router.refresh();
    });
  }

  return (
    <ArticleListShell
      title="Categories"
      description="Browse articles by the system they belong to."
      showCreate={false}
      action={
        canManage ? (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover"
          >
            <Plus size={15} aria-hidden />
            New category
          </button>
        ) : null
      }
    >
      {categories.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-4 py-16 text-center">
          <p className="text-[13px] font-medium text-fg-muted">No categories yet</p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgba(15,23,42,.06),0_4px_12px_rgba(15,23,42,.04)]">
          {categories.map((category) => {
            const blocked = category.count > 0;
            return (
              <li key={category.slug} className="flex items-center gap-2 px-2 py-1.5">
                <Link
                  href={`/categories/${category.slug}`}
                  className="flex min-w-0 flex-1 items-center justify-between gap-4 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-muted"
                >
                  <span className="truncate text-[14px] font-medium text-fg">{category.name}</span>
                  <span className="shrink-0 text-[12px] text-fg-subtle tabular-nums">
                    {category.count} {category.count === 1 ? "article" : "articles"}
                  </span>
                </Link>
                {canManage ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => openRename(category)}
                    >
                      Rename
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={blocked}
                      aria-label={
                        blocked
                          ? `Cannot delete ${category.name} because it still has articles`
                          : `Delete ${category.name}`
                      }
                      onClick={() => openDelete(category)}
                    >
                      Delete
                    </Button>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={mode?.type === "create" || mode?.type === "rename"} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <form onSubmit={submitName}>
            <DialogHeader>
              <DialogTitle>{mode?.type === "rename" ? "Rename category" : "New category"}</DialogTitle>
              <DialogDescription>
                {mode?.type === "rename"
                  ? `The address stays /categories/${mode.category.slug}.`
                  : "Articles can be filed under this category from the editor."}
              </DialogDescription>
            </DialogHeader>
            <label className="mt-4 block text-[12px] font-medium text-fg-muted" htmlFor="category-name">
              Name
              <input
                id="category-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                autoFocus
                className={`${fieldClass} mt-1`}
              />
            </label>
            {error ? (
              <p className="mt-3 text-[12px] font-medium text-warning" role="alert">
                {error}
              </p>
            ) : null}
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" disabled={pending} onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : mode?.type === "rename" ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={mode?.type === "delete"} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {mode?.type === "delete" ? mode.category.name : "category"}?</DialogTitle>
            <DialogDescription>This category has no articles. Deleting it cannot be undone.</DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="text-[12px] font-medium text-warning" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={close}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={confirmDelete}>
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ArticleListShell>
  );
}
