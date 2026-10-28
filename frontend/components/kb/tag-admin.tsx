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
  createTag,
  deleteTag,
  mergeTag,
  renameTag,
} from "@/lib/actions/tags";

type TagRow = { name: string; slug: string; count: number };
type DialogMode =
  | { type: "create" }
  | { type: "rename"; tag: TagRow }
  | { type: "delete"; tag: TagRow }
  | { type: "merge"; tag: TagRow };

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] leading-5 text-fg placeholder:text-fg-subtle/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30";

export function TagAdmin({
  tags,
  canManage,
}: {
  tags: TagRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<DialogMode | null>(null);
  const [name, setName] = useState("");
  const [intoSlug, setIntoSlug] = useState("");
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setName("");
    setError(null);
    setMode({ type: "create" });
  }

  function openRename(tag: TagRow) {
    setName(tag.name);
    setError(null);
    setMode({ type: "rename", tag });
  }

  function openDelete(tag: TagRow) {
    setError(null);
    setMode({ type: "delete", tag });
  }

  function openMerge(tag: TagRow) {
    const other = tags.find((item) => item.slug !== tag.slug);
    setIntoSlug(other?.slug ?? "");
    setError(null);
    setMode({ type: "merge", tag });
  }

  function close() {
    if (pending) return;
    setMode(null);
    setError(null);
  }

  function submitName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mode || (mode.type !== "create" && mode.type !== "rename")) return;
    const nextName = name;
    const current = mode;
    startTransition(async () => {
      const result =
        current.type === "create"
          ? await createTag(nextName)
          : await renameTag(current.tag.slug, nextName);
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
    const slug = mode.tag.slug;
    startTransition(async () => {
      const result = await deleteTag(slug);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMode(null);
      router.refresh();
    });
  }

  function confirmMerge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mode || mode.type !== "merge") return;
    const from = mode.tag.slug;
    const into = intoSlug;
    startTransition(async () => {
      const result = await mergeTag(from, into);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMode(null);
      router.refresh();
    });
  }

  const mergeTargets =
    mode?.type === "merge" ? tags.filter((tag) => tag.slug !== mode.tag.slug) : [];

  return (
    <ArticleListShell
      title="Tags"
      description="Browse articles by topic."
      showCreate={false}
      action={
        canManage ? (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover"
          >
            <Plus size={15} aria-hidden />
            New tag
          </button>
        ) : null
      }
    >
      {tags.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-4 py-16 text-center">
          <p className="text-[13px] font-medium text-fg-muted">No tags yet</p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgba(15,23,42,.06),0_4px_12px_rgba(15,23,42,.04)]">
          {tags.map((tag) => {
            const blocked = tag.count > 0;
            return (
              <li key={tag.slug} className="flex items-center gap-2 px-2 py-1.5">
                <Link
                  href={`/tags/${tag.slug}`}
                  className="flex min-w-0 flex-1 items-center justify-between gap-4 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-muted"
                >
                  <span className="truncate text-[14px] font-medium text-fg">{tag.name}</span>
                  <span className="shrink-0 text-[12px] text-fg-subtle tabular-nums">
                    {tag.count} {tag.count === 1 ? "article" : "articles"}
                  </span>
                </Link>
                {canManage ? (
                  <>
                    <Button type="button" variant="ghost" size="sm" onClick={() => openRename(tag)}>
                      Rename
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={tags.length < 2}
                      onClick={() => openMerge(tag)}
                    >
                      Merge
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={blocked}
                      aria-label={
                        blocked
                          ? `Cannot delete ${tag.name} because it is still on articles`
                          : `Delete ${tag.name}`
                      }
                      onClick={() => openDelete(tag)}
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

      <Dialog
        open={mode?.type === "create" || mode?.type === "rename"}
        onOpenChange={(open) => !open && close()}
      >
        <DialogContent>
          <form onSubmit={submitName}>
            <DialogHeader>
              <DialogTitle>{mode?.type === "rename" ? "Rename tag" : "New tag"}</DialogTitle>
              <DialogDescription>
                {mode?.type === "rename"
                  ? `The address stays /tags/${mode.tag.slug}.`
                  : "Authors can add this tag from the editor."}
              </DialogDescription>
            </DialogHeader>
            <label className="mt-4 block text-[12px] font-medium text-fg-muted" htmlFor="tag-name">
              Name
              <input
                id="tag-name"
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

      <Dialog open={mode?.type === "merge"} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <form onSubmit={confirmMerge}>
            <DialogHeader>
              <DialogTitle>
                Merge {mode?.type === "merge" ? mode.tag.name : "tag"}?
              </DialogTitle>
              <DialogDescription>
                Articles keep the target tag. “
                {mode?.type === "merge" ? mode.tag.name : ""}” is removed afterward.
              </DialogDescription>
            </DialogHeader>
            <label className="mt-4 block text-[12px] font-medium text-fg-muted" htmlFor="merge-into">
              Merge into
              <select
                id="merge-into"
                value={intoSlug}
                onChange={(event) => setIntoSlug(event.target.value)}
                required
                className={`${fieldClass} mt-1`}
              >
                <option value="" disabled>
                  Choose a tag…
                </option>
                {mergeTargets.map((tag) => (
                  <option key={tag.slug} value={tag.slug}>
                    {tag.name} ({tag.count})
                  </option>
                ))}
              </select>
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
              <Button type="submit" disabled={pending || !intoSlug}>
                {pending ? "Merging…" : "Merge"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={mode?.type === "delete"} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {mode?.type === "delete" ? mode.tag.name : "tag"}?</DialogTitle>
            <DialogDescription>
              This tag is not on any articles. Deleting it cannot be undone.
            </DialogDescription>
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
