"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  FileText,
  Pencil,
  Search,
} from "lucide-react";
import { can, canEditArticle, listableStatuses, type Role } from "@/lib/auth/policy";
import type { Article, ArticleStatus, ArticleCategory } from "@/lib/types/article";
import { CategoryChip } from "@/components/kb/category-chip";
import { DeleteArticleButton } from "@/components/kb/delete-article-button";
import { SearchSnippet } from "@/components/kb/search-snippet";
import type { SearchHit } from "@/lib/queries/search";
import { StatusChip } from "@/components/kb/status-chip";
import { TagChip } from "@/components/kb/tag-chip";
import ArticleFilters from "@/components/kb/article-filters";
import DensityToggle, { type Density } from "@/components/kb/density-toggle";

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

type SortKey = "title" | "author" | "status" | "updatedAt" | "views";
type SortDir = "asc" | "desc";

function comparator(key: SortKey, dir: SortDir) {
  const m = dir === "asc" ? 1 : -1;
  return (a: Article, b: Article): number => {
    switch (key) {
      case "title":
        return m * a.title.localeCompare(b.title);
      case "author":
        return m * a.author.name.localeCompare(b.author.name);
      case "status":
        return m * a.status.localeCompare(b.status);
      case "updatedAt":
        return (
          m *
          (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
        );
      case "views":
        return m * (a.views - b.views);
      default:
        return 0;
    }
  };
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function applyFilters(
  articles: Article[],
  category: string | null,
  status: ArticleStatus | null,
  period: string | null,
  search: string,
): Article[] {
  let result = articles;
  if (category) result = result.filter((a) => a.category?.slug === category);
  if (status) result = result.filter((a) => a.status === status);
  if (period) {
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const cutoff = daysAgo(days);
    result = result.filter((a) => new Date(a.updatedAt) >= cutoff);
  }
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    result = result.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.summary?.toLowerCase().includes(q) ||
        a.category?.name.toLowerCase().includes(q) ||
        a.tags.some((t) => t.name.toLowerCase().includes(q)),
    );
  }
  return result;
}

// ---------------------------------------------------------------------------
// Column header
// ---------------------------------------------------------------------------

function SortHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = currentKey === sortKey;
  const Icon = active
    ? currentDir === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`group inline-flex items-center gap-1 ${
        align === "right" ? "justify-end" : ""
      }`}
    >
      <span>{label}</span>
      <Icon
        size={11}
        className={
          active
            ? "text-accent"
            : "text-transparent group-hover:text-fg-subtle transition-colors"
        }
        aria-hidden
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatViews(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

interface ArticleTableProps {
  articles: Article[];
  emptyTitle?: string;
  emptyHint?: string;
  actor?: { role: Role; userId: string } | null;
}

function deriveCategories(articles: Article[]): ArticleCategory[] {
  const map = new Map<string, ArticleCategory>();
  for (const a of articles) {
    if (a.category && !map.has(a.category.slug)) {
      map.set(a.category.slug, a.category);
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export default function ArticleTable({
  articles,
  emptyTitle = "No articles match your filters",
  emptyHint = "Try broadening your search or removing a filter.",
  actor = null,
}: ArticleTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [density, setDensity] = useState<Density>("comfortable");
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<ArticleStatus | null>(
    null,
  );
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed.length < 2) {
      setHits(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/search?q=${encodeURIComponent(trimmed)}&limit=20`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : { hits: [] }))
        .then((body: { hits?: SearchHit[] }) => {
          if (!controller.signal.aborted) setHits(body.hits ?? []);
        })
        .catch(() => {
          if (!controller.signal.aborted) setHits([]);
        });
    }, 200);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [search]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    const narrowed = applyFilters(articles, selectedCategory, selectedStatus, selectedPeriod, "");
    if (!hits) return applyFilters(articles, selectedCategory, selectedStatus, selectedPeriod, search);
    const bySlug = new Map(narrowed.map((article) => [article.slug, article]));
    return hits.flatMap((hit) => {
      const article = bySlug.get(hit.slug);
      return article ? [article] : [];
    });
  }, [articles, hits, search, selectedCategory, selectedStatus, selectedPeriod]);

  const ranked = Boolean(hits) && sortKey === "updatedAt" && sortDir === "desc";
  const sorted = useMemo(
    () => (ranked ? filtered : [...filtered].sort(comparator(sortKey, sortDir))),
    [filtered, ranked, sortKey, sortDir],
  );
  const snippets = useMemo(() => new Map((hits ?? []).map((hit) => [hit.slug, hit.snippet])), [hits]);

  const isCompact = density === "compact";

  return (
    <div className="space-y-3">
      {/* Toolbar row: search + filters + density */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative w-56">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle"
            aria-hidden
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search articles…"
            data-search-field=""
            className="
              w-full rounded-lg border border-border bg-surface
              py-1.5 pl-8 pr-3 text-[13px] text-fg
              placeholder:text-fg-subtle/50
              outline-none shadow-none focus:border-border-strong focus:shadow-none
              transition-colors
            "
          />
        </div>

        {/* Filter dropdowns */}
        <ArticleFilters
          categories={deriveCategories(articles)}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
          statuses={actor ? listableStatuses(actor.role) : ["published"]}
          selectedPeriod={selectedPeriod}
          onPeriodChange={setSelectedPeriod}
        />

        {/* Right: count + density */}
        <div className="ml-auto flex items-center gap-2.5">
          <span className="text-[12px] tabular-nums text-fg-subtle">
            {sorted.length} article{sorted.length !== 1 ? "s" : ""}
          </span>
          <DensityToggle value={density} onChange={setDensity} />
        </div>
      </div>

      {/* Table card */}
      <div className="rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgba(15,23,42,.06),0_4px_12px_rgba(15,23,42,.04)]">
        <table className="w-full table-fixed text-left">
          <colgroup>
            <col className="w-[30%]" />
            <col className="w-[12%]" />
            <col className="w-[13%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[7%]" />
            <col className="w-[18%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border">
              {(
                [
                  { key: "title", label: "Title", align: "left" },
                  { key: "author", label: "Author", align: "left" },
                  { key: null, label: "Tags", align: "left" },
                  { key: "status", label: "Status", align: "left" },
                  { key: "updatedAt", label: "Updated", align: "left" },
                  { key: "views", label: "Views", align: "right" },
                  { key: null, label: "", align: "right" },
                ] as { key: SortKey | null; label: string; align: "left" | "right" }[]
              ).map((col, i) => (
                <th
                  key={i}
                  className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-subtle ${
                    col.align === "right" ? "text-right" : ""
                  }`}
                >
                  {col.key ? (
                    <SortHeader
                      label={col.label}
                      sortKey={col.key}
                      currentKey={sortKey}
                      currentDir={sortDir}
                      onSort={handleSort}
                      align={col.align}
                    />
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <FileText
                    size={28}
                    className="mx-auto mb-2 text-fg-subtle/30"
                    aria-hidden
                  />
                  <p className="text-[13px] font-medium text-fg-muted">
                    {articles.length === 0 ? emptyTitle : "No articles match your filters"}
                  </p>
                  <p className="mt-0.5 text-[12px] text-fg-subtle">
                    {articles.length === 0
                      ? emptyHint
                      : "Try broadening your search or removing a filter."}
                  </p>
                </td>
              </tr>
            )}
            {sorted.map((article) => (
              <tr
                key={article.id}
                className="group transition-colors hover:bg-surface-muted/50"
              >
                {/* Title */}
                <td className={`px-3 ${isCompact ? "py-1.5" : "py-2.5"}`}>
                  <div className="flex min-w-0 items-center gap-2">
                    {article.category && (
                      <CategoryChip
                        name={article.category.name}
                        slug={article.category.slug}
                        color={article.category.color}
                        className="shrink-0 px-1.5 py-px text-[10px]"
                      />
                    )}
                    <div className="min-w-0">
                      <Link
                        href={`/kb/${article.slug}`}
                        className="block truncate text-[13px] font-medium text-fg transition-colors group-hover:text-accent"
                      >
                        {article.title}
                      </Link>
                      {snippets.get(article.slug) ? <SearchSnippet snippet={snippets.get(article.slug) ?? ""} /> : null}
                    </div>
                  </div>
                </td>

                {/* Author */}
                <td
                  className={`px-3 text-[12px] text-fg-muted ${isCompact ? "py-1.5" : "py-2.5"}`}
                >
                  {article.author.name}
                </td>

                {/* Tags */}
                <td className={`px-3 ${isCompact ? "py-1.5" : "py-2.5"}`}>
                  <div className="flex items-center gap-1 overflow-hidden">
                    {article.tags.slice(0, 2).map((tag) => (
                      <TagChip
                        key={tag.slug}
                        name={tag.name}
                        slug={tag.slug}
                        className="px-1.5 py-px text-[10px]"
                      />
                    ))}
                    {article.tags.length > 2 && (
                      <span className="shrink-0 text-[10px] text-fg-subtle">
                        +{article.tags.length - 2}
                      </span>
                    )}
                  </div>
                </td>

                {/* Status */}
                <td className={`px-3 ${isCompact ? "py-1.5" : "py-2.5"}`}>
                  <StatusChip status={article.status} className="text-[10px] px-1.5 py-px" />
                </td>

                {/* Updated */}
                <td
                  className={`px-3 text-[12px] tabular-nums text-fg-subtle ${isCompact ? "py-1.5" : "py-2.5"}`}
                >
                  {shortDate(article.updatedAt)}
                </td>

                {/* Views */}
                <td
                  className={`px-3 text-right ${isCompact ? "py-1.5" : "py-2.5"}`}
                >
                  <span className="inline-flex items-center gap-1 text-[12px] tabular-nums text-fg-subtle">
                    <Eye size={11} aria-hidden />
                    {formatViews(article.views)}
                  </span>
                </td>

                <td className={`px-3 text-right ${isCompact ? "py-1.5" : "py-2.5"}`}>
                  <div className="flex flex-nowrap items-center justify-end gap-2">
                  {actor &&
                  article.author.id &&
                  canEditArticle(actor.role, actor.userId, {
                    authorId: article.author.id,
                    status: article.status,
                  }) ? (
                    <Link
                      href={`/kb/${article.slug}/edit`}
                      className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent hover:text-accent-hover"
                    >
                      <Pencil size={12} aria-hidden />
                      Edit
                    </Link>
                  ) : null}
                  {actor && can(actor.role, "article.delete") ? (
                    <DeleteArticleButton articleId={article.id} title={article.title} compact />
                  ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
