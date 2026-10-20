"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { articleSaveError, can, type Role } from "@/lib/auth/policy";
import type { ArticleStatus } from "@/lib/types/article";
import {
  EDITABLE_KINDS,
  type DraftIssue,
  type EditorDraft,
  type EditorSection,
  calloutIssues,
  defaultSection,
  slugifyTitle,
} from "@/lib/editor/draft";
import { saveArticle } from "@/lib/actions/save-article";
import { PublishDialog } from "@/components/kb/editor/publish-dialog";
import { SectionCard } from "@/components/kb/editor/section-fields";
import { Button } from "@/components/ui/button";
import type { VersionBump } from "@/lib/editor/draft";

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] leading-5 text-fg focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30";

const STATUS_OPTIONS: { value: ArticleStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "in_review", label: "In Review" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

function statusChoices(role: Role, current: ArticleStatus) {
  return STATUS_OPTIONS.filter((option) => {
    if (option.value === "published" && current !== "published") return false;
    if (option.value === current) return true;
    return (
      articleSaveError({
        role,
        userId: "editor",
        existing: { authorId: "editor", status: current },
        nextStatus: option.value,
        publishing: false,
      }) === null
    );
  });
}

export function ArticleEditor({
  draft: initial,
  categories,
  tags,
  role,
  parentTitle = null,
}: {
  draft: EditorDraft;
  categories: { name: string; slug: string }[];
  tags: { name: string; slug: string }[];
  role: Role;
  parentTitle?: string | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [savedJson] = useState(() => JSON.stringify(initial));
  const [error, setError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [issues, setIssues] = useState<DraftIssue[]>([]);
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(draft) !== savedJson;

  const used = new Set(draft.sections.map((section) => section.kind));
  const available = EDITABLE_KINDS.filter((kind) => !used.has(kind));
  const slugPreview = draft.slug ?? slugifyTitle(draft.title);

  function updateSection(index: number, section: EditorSection) {
    setDraft((current) => {
      const sections = current.sections.slice();
      sections[index] = section;
      return { ...current, sections };
    });
  }

  function validateCallouts(): boolean {
    const nextIssues = calloutIssues(draft);
    setIssues(nextIssues);
    if (!draft.title.trim()) {
      setError("Title is required.");
      return false;
    }
    if (nextIssues.length > 0) {
      setError("Fill in each callout title and body, or remove the callout.");
      return false;
    }
    return true;
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!validateCallouts()) return;
    startTransition(async () => {
      const result = await saveArticle(draft);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/kb/${result.slug}`);
      router.refresh();
    });
  }

  function openPublish() {
    setError(null);
    setPublishError(null);
    if (!validateCallouts()) return;
    setPublishOpen(true);
  }

  function onPublish(bump: Exclude<VersionBump, "patch">) {
    setPublishError(null);
    startTransition(async () => {
      const result = await saveArticle({ ...draft, status: "published" }, bump);
      if (!result.ok) {
        setPublishError(result.error);
        return;
      }
      setPublishOpen(false);
      router.push(`/kb/${result.slug}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-[1200px] px-6 py-5">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] leading-7 font-bold tracking-tight text-fg">
            {draft.slug ? "Edit article" : "New article"}
          </h1>
          <p className="mt-0.5 text-[13px] text-fg-subtle">
            {parentTitle ? `Child of ${parentTitle} · ` : null}/kb/{slugPreview}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={draft.slug ? `/kb/${draft.slug}` : "/kb"}
            onClick={(event) => {
              if (!dirty) return;
              if (!window.confirm("Discard unsaved changes?")) event.preventDefault();
            }}
            className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-[13px] font-semibold text-fg-muted hover:bg-surface-muted"
          >
            Cancel
          </Link>
          <Button type="submit" variant="outline" disabled={pending}>
            {pending && !publishOpen ? "Saving…" : "Save"}
          </Button>
          {can(role, "article.publish") ? (
            <Button type="button" disabled={pending} onClick={openPublish}>
              Publish
            </Button>
          ) : null}
        </div>
      </div>

      <PublishDialog
        draft={draft}
        open={publishOpen}
        pending={pending && publishOpen}
        error={publishError}
        onOpenChange={setPublishOpen}
        onPublish={onPublish}
      />

      <div className="flex items-start gap-6">
        <div className="min-w-0 flex-1 space-y-4">
          {draft.sections.map((section, index) => (
            <SectionCard
              key={section.kind}
              section={section}
              issues={issues.filter((issue) => issue.sectionIndex === index)}
              onChange={(next) => updateSection(index, next)}
              onRemove={() =>
                setDraft((current) => ({
                  ...current,
                  sections: current.sections.filter((_, i) => i !== index),
                }))
              }
            />
          ))}

          {available.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {available.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      sections: [...current.sections, defaultSection(kind)],
                    }))
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-2.5 py-1.5 text-[12px] font-medium text-fg-muted hover:border-accent hover:text-accent"
                >
                  <Plus size={12} aria-hidden />
                  {defaultSection(kind).title}
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="sticky top-24 w-[300px] shrink-0 self-start space-y-4 rounded-xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,.06),0_8px_24px_rgba(15,23,42,.04)]">
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-fg-muted">Title</span>
            <input
              required
              value={draft.title}
              onChange={(event) =>
                setDraft((current) => ({ ...current, title: event.target.value }))
              }
              className={fieldClass}
              placeholder="Article title"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-fg-muted">Summary</span>
            <textarea
              value={draft.summary}
              onChange={(event) =>
                setDraft((current) => ({ ...current, summary: event.target.value }))
              }
              rows={4}
              className={fieldClass}
              placeholder="One or two sentences."
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-fg-muted">Category</span>
            <select
              value={draft.categorySlug ?? ""}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  categorySlug: event.target.value || null,
                }))
              }
              className={fieldClass}
            >
              <option value="">None</option>
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="mb-1 block text-[12px] font-medium text-fg-muted">Tags</span>
            <div className="mb-2 flex flex-wrap gap-1">
              {draft.tagSlugs.map((slug) => {
                const tag = tags.find((item) => item.slug === slug);
                return (
                  <button
                    key={slug}
                    type="button"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        tagSlugs: current.tagSlugs.filter((item) => item !== slug),
                      }))
                    }
                    className="rounded-xs bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent"
                  >
                    {tag?.name ?? slug} ×
                  </button>
                );
              })}
            </div>
            <select
              value=""
              onChange={(event) => {
                const slug = event.target.value;
                if (!slug || draft.tagSlugs.includes(slug)) return;
                setDraft((current) => ({
                  ...current,
                  tagSlugs: [...current.tagSlugs, slug],
                }));
              }}
              className={fieldClass}
              aria-label="Add tag"
            >
              <option value="">Add tag…</option>
              {tags
                .filter((tag) => !draft.tagSlugs.includes(tag.slug))
                .map((tag) => (
                  <option key={tag.slug} value={tag.slug}>
                    {tag.name}
                  </option>
                ))}
            </select>
          </div>

          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-fg-muted">Status</span>
            <select
              value={draft.status}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  status: event.target.value as ArticleStatus,
                }))
              }
              className={fieldClass}
            >
              {statusChoices(role, draft.status).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {can(role, "article.makePublic") ? (
            <label className="flex items-start gap-2 text-[13px] leading-5 text-fg">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={draft.visibility === "public"}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    visibility: event.target.checked ? "public" : "private",
                  }))
                }
              />
              <span>
                <span className="font-medium">Public link</span>
                <span className="mt-0.5 block text-[12px] leading-4 text-fg-subtle">
                  After this article is published, anyone with the link can read it without signing in.
                </span>
              </span>
            </label>
          ) : null}

          {error && (
            <p className="text-[12px] font-medium text-warning" role="alert">
              {error}
            </p>
          )}
        </aside>
      </div>
    </form>
  );
}
