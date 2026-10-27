"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CloudOff, Eye, Loader2, Plus } from "lucide-react";
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
import { autosaveArticle, saveArticle } from "@/lib/actions/save-article";
import {
  clearLocalDraft,
  readLocalDraft,
  writeLocalDraft,
} from "@/lib/editor/local-draft";
import { PreviewDialog } from "@/components/kb/editor/preview-dialog";
import { PublishDialog } from "@/components/kb/editor/publish-dialog";
import { SectionCard } from "@/components/kb/editor/section-fields";
import { Button } from "@/components/ui/button";
import type { VersionBump } from "@/lib/editor/draft";

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13px] leading-5 text-fg focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30";

/**
 * Persist to Postgres after idle typing (Redis 10s buffer is later).
 * localStorage mirrors every change so refresh does not drop the last edit.
 */
const AUTOSAVE_MS = 10_000;

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

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export function ArticleEditor({
  draft: initial,
  categories,
  tags,
  role,
  authorName,
  parentTitle = null,
  notice = null,
}: {
  draft: EditorDraft;
  categories: { name: string; slug: string }[];
  tags: { name: string; slug: string }[];
  role: Role;
  authorName: string;
  parentTitle?: string | null;
  notice?: string | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initial));
  const [error, setError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [issues, setIssues] = useState<DraftIssue[]>([]);
  const [pending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [localReady, setLocalReady] = useState(false);

  const draftRef = useRef(draft);
  const savedJsonRef = useRef(savedJson);
  const flushingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  draftRef.current = draft;
  savedJsonRef.current = savedJson;

  const dirty = JSON.stringify(draft) !== savedJson;
  const used = new Set(draft.sections.map((section) => section.kind));
  const available = EDITABLE_KINDS.filter((kind) => !used.has(kind));
  const slugPreview = draft.slug ?? slugifyTitle(draft.title);

  // Restore a browser mirror left by a refresh before Postgres flush finished.
  useEffect(() => {
    const local = readLocalDraft(initial.slug);
    const initialJson = JSON.stringify(initial);
    if (local && JSON.stringify(local) !== initialJson) {
      setDraft(local);
      draftRef.current = local;
      setSaveStatus("dirty");
    }
    setLocalReady(true);
    // Only on mount for this article.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.slug]);

  useEffect(() => {
    if (!localReady) return;
    writeLocalDraft(draft);
  }, [draft, localReady]);

  const flushAutosave = useCallback(async () => {
    const current = draftRef.current;
    const snapshot = JSON.stringify(current);
    if (snapshot === savedJsonRef.current) return;
    if (flushingRef.current || pending || publishOpen) return;
    if (!current.title.trim()) {
      setSaveStatus("dirty");
      return;
    }

    flushingRef.current = true;
    setSaveStatus("saving");
    setAutosaveError(null);
    writeLocalDraft(current);
    try {
      const result = await autosaveArticle(current);
      if (!result.ok) {
        setAutosaveError(result.error);
        setSaveStatus("error");
        return;
      }
      if (result.skipped) {
        setSaveStatus("dirty");
        return;
      }

      const nextDraft =
        result.created || !current.slug
          ? { ...current, slug: result.slug, version: current.version ?? "1.0" }
          : current;
      if (result.created || nextDraft !== current) {
        setDraft(nextDraft);
        draftRef.current = nextDraft;
      }
      const nextJson = JSON.stringify(nextDraft);
      setSavedJson(nextJson);
      savedJsonRef.current = nextJson;
      setSaveStatus("saved");
      clearLocalDraft(nextDraft.slug);
      writeLocalDraft(nextDraft);

      if (result.created) {
        clearLocalDraft(null);
        router.replace(`/kb/${result.slug}/edit`);
      }
    } catch {
      setAutosaveError("Autosave failed. Your edits are still in this tab.");
      setSaveStatus("error");
    } finally {
      flushingRef.current = false;
    }
  }, [pending, publishOpen, router]);

  useEffect(() => {
    if (!localReady || !dirty) return;
    setSaveStatus((current) => (current === "saving" ? current : "dirty"));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void flushAutosave();
    }, AUTOSAVE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dirty, draft, flushAutosave, localReady]);

  useEffect(() => {
    function stashAndFlush() {
      writeLocalDraft(draftRef.current);
      void flushAutosave();
    }
    function onHide() {
      if (document.visibilityState === "hidden") stashAndFlush();
    }
    function onBeforeUnload(event: BeforeUnloadEvent) {
      writeLocalDraft(draftRef.current);
      const snapshot = JSON.stringify(draftRef.current);
      if (snapshot === savedJsonRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("blur", stashAndFlush);
    window.addEventListener("pagehide", stashAndFlush);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("blur", stashAndFlush);
      window.removeEventListener("pagehide", stashAndFlush);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [flushAutosave]);

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
      setSavedJson(JSON.stringify(draft));
      clearLocalDraft(result.slug);
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
      setSavedJson(JSON.stringify(draft));
      clearLocalDraft(result.slug);
      router.push(`/kb/${result.slug}`);
      router.refresh();
    });
  }

  const autosaveChip =
    saveStatus === "saving"
      ? {
          label: "Autosaving…",
          className: "border-border bg-surface-muted text-fg-muted",
          icon: <Loader2 size={12} className="animate-spin" aria-hidden />,
        }
      : saveStatus === "saved"
        ? {
            label: "Autosaved",
            className: "border-success/30 bg-success-soft text-success",
            icon: <Check size={12} strokeWidth={2.5} aria-hidden />,
          }
        : saveStatus === "error"
          ? {
              label: "Autosave failed",
              className: "border-warning/40 bg-warning-soft text-warning",
              icon: <CloudOff size={12} aria-hidden />,
            }
          : saveStatus === "dirty"
            ? {
                label: draft.title.trim()
                  ? "Unsaved · autosaves in ~10s"
                  : "Add a title to autosave",
                className: "border-border bg-surface text-fg-muted",
                icon: null,
              }
            : null;

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
          {notice ? <p className="mt-1 text-[13px] text-fg">{notice}</p> : null}
          {autosaveError ? (
            <p className="mt-1 text-[12px] font-medium text-warning" role="alert">
              {autosaveError}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {autosaveChip ? (
            <span
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-semibold ${autosaveChip.className}`}
              aria-live="polite"
            >
              {autosaveChip.icon}
              {autosaveChip.label}
            </span>
          ) : null}
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
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => setPreviewOpen(true)}
          >
            <Eye size={14} aria-hidden />
            Preview
          </Button>
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

      <PreviewDialog
        draft={draft}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        authorName={authorName}
        categories={categories}
        tags={tags}
      />

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
          <div className="rounded-xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,.06)]">
            <label className="block">
              <span className="mb-1 block text-[12px] font-medium text-fg-muted">
                Article title
              </span>
              <input
                required
                value={draft.title}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, title: event.target.value }))
                }
                className="w-full border-0 bg-transparent text-[22px] leading-7 font-bold tracking-tight text-fg outline-none placeholder:text-fg-subtle/50 focus:ring-0"
                placeholder="Name this article…"
                aria-label="Article title"
              />
            </label>
            <label className="mt-3 block">
              <span className="mb-1 block text-[12px] font-medium text-fg-muted">Summary</span>
              <textarea
                value={draft.summary}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, summary: event.target.value }))
                }
                rows={2}
                className={`${fieldClass} resize-y`}
                placeholder="One or two sentences readers see under the title."
              />
            </label>
          </div>

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
