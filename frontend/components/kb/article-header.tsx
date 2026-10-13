import Link from "next/link";
import { Calendar, Clock, MoreHorizontal, Pencil, Share2 } from "lucide-react";
import type { Article } from "@/lib/types/article";
import { CategoryChip } from "@/components/kb/category-chip";
import { StatusChip } from "@/components/kb/status-chip";

/**
 * Article title block: category chip, h1, summary, metadata row,
 * hero image (right-aligned), and action buttons.
 *
 * Matches the top section of the north-star mock.
 */
export function ArticleHeader({ article }: { article: Article }) {
  const formattedDate = new Date(article.createdAt).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" },
  );

  const initials = article.author.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-start justify-between gap-6">
      {/* Left: text content */}
      <div className="min-w-0 flex-1">
        {/* Category chip */}
        {article.category && (
          <CategoryChip
            name={article.category.name}
            slug={article.category.slug}
            className="mb-3"
          />
        )}

        {/* Title */}
        <h1 className="text-[28px] leading-9 font-bold tracking-tight text-fg">
          {article.title}
        </h1>

        {/* Summary */}
        {article.summary && (
          <p className="mt-2 max-w-[640px] text-[15px] leading-6 text-fg-muted">
            {article.summary}
          </p>
        )}

        {/* Metadata row */}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-[13px] leading-5 text-fg-subtle">
          {/* Author */}
          <span className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-white">
              {initials}
            </span>
            <span>
              Created by{" "}
              <span className="font-medium text-fg">{article.author.name}</span>
            </span>
          </span>

          <span aria-hidden className="text-border-strong">·</span>

          {/* Date */}
          <span className="flex items-center gap-1.5">
            <Calendar size={14} aria-hidden />
            {formattedDate}
          </span>

          <span aria-hidden className="text-border-strong">·</span>

          {/* Read time */}
          <span className="flex items-center gap-1.5">
            <Clock size={14} aria-hidden />
            {article.readingTimeMinutes} min read
          </span>

          <span aria-hidden className="text-border-strong">·</span>

          {/* Status */}
          <StatusChip status={article.status} />
        </div>
      </div>

      {/* Right: actions + hero */}
      <div className="flex shrink-0 flex-col items-end gap-4">
        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Link
            href={`/kb/${article.slug}/edit`}
            className="inline-flex h-9 items-center gap-2 rounded-sm bg-accent px-3.5 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover"
          >
            <Pencil size={14} aria-hidden />
            Edit
          </Link>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-sm border border-border-strong bg-surface px-3.5 text-[14px] font-semibold text-fg transition-colors hover:bg-surface-muted"
          >
            <Share2 size={14} aria-hidden />
            Share
          </button>
          <button
            type="button"
            aria-label="More actions"
            className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border-strong bg-surface text-fg-subtle transition-colors hover:bg-surface-muted hover:text-fg"
          >
            <MoreHorizontal size={16} aria-hidden />
          </button>
        </div>

        {/* Hero image placeholder — 16/10 aspect per spec §10 */}
        <div
          className="w-[220px] overflow-hidden rounded-lg"
          style={{
            aspectRatio: "16 / 10",
            background:
              "linear-gradient(135deg, #0078D4 0%, #00BCF2 40%, #7FBA00 70%, #FFB900 100%)",
          }}
          role="img"
          aria-label="Windows 11 hero artwork"
        />
      </div>
    </div>
  );
}
