import Link from "next/link";
import {
  ChevronRight,
  Copy,
  Download,
  FileText,
  MoreVertical,
  Pencil,
  Printer,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import type { Article } from "@/lib/types/article";
import { TagChip } from "@/components/kb/tag-chip";
import { CategoryChip } from "@/components/kb/category-chip";

/**
 * Right-rail meta column (320px sticky).
 *
 * Cards: Article Details, Related Articles, Quick Actions, Was this helpful?
 * Matches the right side of the north-star mock.
 */
export function ArticleRightRail({
  article,
  related,
  canEdit = false,
}: {
  article: Article;
  related: { title: string; slug: string }[];
  canEdit?: boolean;
}) {
  return (
    <aside className="sticky top-24 flex w-[300px] shrink-0 self-start flex-col gap-5">
      <ArticleDetailsCard article={article} />
      <RelatedArticlesCard article={article} related={related} />
      <QuickActionsCard slug={article.slug} canEdit={canEdit} />
      <FeedbackCard article={article} />
    </aside>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function ArticleDetailsCard({ article }: { article: Article }) {
  const updatedDate = new Date(article.updatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const initials = article.author.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-[16px] leading-6 font-semibold text-fg">
          Article Details
        </h3>
        <button
          type="button"
          aria-label="More options"
          className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-fg-subtle transition-colors hover:bg-surface-muted hover:text-fg"
        >
          <MoreVertical size={16} aria-hidden />
        </button>
      </div>

      <dl className="mt-4 flex flex-col gap-3.5 text-[13px] leading-5">
        <DetailRow label="Article ID">
          <span className="font-mono text-[12px] tabular-nums text-fg">
            {article.id}
          </span>
        </DetailRow>

        <DetailRow label="Category">
          {article.category && (
            <CategoryChip name={article.category.name} slug={article.category.slug} />
          )}
        </DetailRow>

        <DetailRow label="Tags">
          <div className="flex flex-wrap gap-1.5">
            {article.tags.map((tag) => (
              <TagChip key={tag.slug} name={tag.name} slug={tag.slug} />
            ))}
          </div>
        </DetailRow>

        <DetailRow label="Last Updated">
          <span className="text-fg">{updatedDate}</span>
        </DetailRow>

        <DetailRow label="Created By">
          <span className="flex items-center gap-1.5">
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[9px] font-semibold text-white">
              {initials}
            </span>
            <span className="text-fg">{article.author.name}</span>
          </span>
        </DetailRow>

        <DetailRow label="Version">
          <span className="tabular-nums text-fg">{article.version}</span>
        </DetailRow>
      </dl>
    </div>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-fg-subtle">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function RelatedArticlesCard({
  article,
  related,
}: {
  article: Article;
  related: { title: string; slug: string }[];
}) {
  const viewAllHref = article.category
    ? `/categories/${article.category.slug}`
    : "/kb";

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-[16px] leading-6 font-semibold text-fg">
          Related Articles
        </h3>
        <Link
          href={viewAllHref}
          className="text-[13px] font-medium text-accent transition-colors hover:text-accent-hover hover:underline"
        >
          View All
        </Link>
      </div>

      {related.length === 0 ? (
        <p className="mt-3 text-[13px] leading-5 text-fg-subtle">
          No other published articles yet.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-0.5">
          {related.map((item) => (
            <li key={item.slug}>
              <Link
                href={`/kb/${item.slug}`}
                className="flex items-start gap-2.5 rounded-sm px-1 py-2 text-[13px] leading-5 text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
              >
                <FileText
                  size={16}
                  className="mt-0.5 shrink-0 text-fg-subtle"
                  aria-hidden
                />
                <span>{item.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function QuickActionsCard({ slug, canEdit }: { slug: string; canEdit: boolean }) {
  const actions = [
    { label: "Download as PDF", icon: Download },
    { label: "Copy Link", icon: Copy },
    { label: "Print Article", icon: Printer },
  ] as const;

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <h3 className="text-[16px] leading-6 font-semibold text-fg">
        Quick Actions
      </h3>
      <ul className="mt-3 flex flex-col gap-0.5">
        {canEdit ? (
          <li>
            <Link
              href={`/kb/${slug}/edit`}
              className="flex w-full items-center gap-3 rounded-sm px-1 py-2 text-[13px] leading-5 font-medium text-fg transition-colors hover:bg-surface-muted"
            >
              <Pencil size={16} className="shrink-0 text-accent" aria-hidden />
              <span className="flex-1 text-left">Edit article</span>
              <ChevronRight size={14} className="shrink-0 text-fg-subtle/60" aria-hidden />
            </Link>
          </li>
        ) : null}
        {actions.map(({ label, icon: Icon }) => (
          <li key={label}>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-sm px-1 py-2 text-[13px] leading-5 text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
            >
              <Icon size={16} className="shrink-0 text-fg-subtle" aria-hidden />
              <span className="flex-1 text-left">{label}</span>
              <ChevronRight
                size={14}
                className="shrink-0 text-fg-subtle/60"
                aria-hidden
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function FeedbackCard({ article }: { article: Article }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <h3 className="text-[16px] leading-6 font-semibold text-fg">
        Was this article helpful?
      </h3>
      <p className="mt-1 text-[13px] leading-5 text-fg-subtle">
        Help us improve by sharing your feedback.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          aria-label="Helpful"
          className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border-strong text-fg-subtle transition-colors hover:bg-surface-muted hover:text-fg"
        >
          <ThumbsUp size={16} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Not helpful"
          className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border-strong text-fg-subtle transition-colors hover:bg-surface-muted hover:text-fg"
        >
          <ThumbsDown size={16} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Leave a comment"
          className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border-strong text-fg-subtle transition-colors hover:bg-surface-muted hover:text-fg"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
