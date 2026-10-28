import type { ArticleStatus } from "@/lib/types/article";

/** Updated-within windows on the article list and search. */
export type UpdatedWithin = "7d" | "30d" | "90d";

export type ArticleFacetFilters = {
  category: string | null;
  status: ArticleStatus | null;
  updated: UpdatedWithin | null;
};

const STATUSES = new Set<ArticleStatus>(["draft", "in_review", "published", "archived"]);
const PERIODS = new Set<UpdatedWithin>(["7d", "30d", "90d"]);

const EMPTY: ArticleFacetFilters = {
  category: null,
  status: null,
  updated: null,
};

/** Parse list/search facet params. Unknown values are ignored. */
export function parseArticleFacets(
  raw: {
    category?: string | null;
    status?: string | null;
    updated?: string | null;
  },
  allowedStatuses?: readonly ArticleStatus[],
): ArticleFacetFilters {
  const category = raw.category?.trim() || null;
  const statusRaw = raw.status?.trim() || null;
  let status: ArticleStatus | null = null;
  if (statusRaw && STATUSES.has(statusRaw as ArticleStatus)) {
    const candidate = statusRaw as ArticleStatus;
    if (!allowedStatuses || allowedStatuses.includes(candidate)) status = candidate;
  }
  const updatedRaw = raw.updated?.trim() || null;
  const updated =
    updatedRaw && PERIODS.has(updatedRaw as UpdatedWithin)
      ? (updatedRaw as UpdatedWithin)
      : null;
  return { category, status, updated };
}

export function hasArticleFacets(filters: ArticleFacetFilters): boolean {
  return Boolean(filters.category || filters.status || filters.updated);
}

/** Cutoff instant for an updated-within window (local calendar days). */
export function updatedWithinCutoff(period: UpdatedWithin): Date {
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}

/** Query-string fragment for `/api/search` (leading `&` when non-empty). */
export function articleFacetsQuery(filters: ArticleFacetFilters): string {
  const parts: string[] = [];
  if (filters.category) parts.push(`category=${encodeURIComponent(filters.category)}`);
  if (filters.status) parts.push(`status=${encodeURIComponent(filters.status)}`);
  if (filters.updated) parts.push(`updated=${encodeURIComponent(filters.updated)}`);
  return parts.length ? `&${parts.join("&")}` : "";
}

/** Build a URLSearchParams patch for the `/kb` list (omits cleared facets). */
export function articleFacetsToSearchParams(
  filters: ArticleFacetFilters,
  current?: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams(current?.toString() ?? "");
  if (filters.category) next.set("category", filters.category);
  else next.delete("category");
  if (filters.status) next.set("status", filters.status);
  else next.delete("status");
  if (filters.updated) next.set("updated", filters.updated);
  else next.delete("updated");
  return next;
}

export const EMPTY_ARTICLE_FACETS = EMPTY;
