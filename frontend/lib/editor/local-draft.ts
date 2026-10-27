import type { EditorDraft } from "@/lib/editor/draft";

function key(slug: string | null): string {
  return `techbase:editor-draft:${slug ?? "new"}`;
}

/** Browser-only mirror so a refresh does not drop an edit before Postgres flush lands. */
export function readLocalDraft(slug: string | null): EditorDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EditorDraft;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.sections)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeLocalDraft(draft: EditorDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(draft.slug), JSON.stringify(draft));
  } catch {
    // Quota or private mode — Postgres autosave remains the source of truth.
  }
}

export function clearLocalDraft(slug: string | null): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(slug));
    if (slug) window.localStorage.removeItem(key(null));
  } catch {
    // ignore
  }
}
