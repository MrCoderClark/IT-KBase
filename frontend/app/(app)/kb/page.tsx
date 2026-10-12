import Link from "next/link";
import { FileText } from "lucide-react";
import { SEED_ARTICLES } from "@/lib/seed/articles";

/**
 * All Articles — temporary list view that links to the seed article.
 * Gets replaced by a full table view in a later pass (M1 → M4).
 */
export default function AllArticlesPage() {
  const articles = Object.values(SEED_ARTICLES);

  return (
    <div className="mx-auto w-full max-w-[1120px] px-8 py-10">
      <div className="text-[11px] leading-4 font-semibold tracking-[0.08em] uppercase text-fg-subtle">
        Knowledge Base
      </div>
      <h1 className="mt-1 text-[28px] leading-9 font-bold tracking-tight text-fg">
        All Articles
      </h1>
      <p className="mt-2 text-[15px] leading-6 text-fg-muted">
        {articles.length} article{articles.length === 1 ? "" : "s"} in the
        knowledge base.
      </p>

      <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-surface shadow-sm">
        {articles.map((article) => (
          <li key={article.slug}>
            <Link
              href={`/kb/${article.slug}`}
              className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-muted"
            >
              <FileText
                size={18}
                className="shrink-0 text-fg-subtle"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] leading-5 font-medium text-fg">
                  {article.title}
                </div>
                <div className="mt-0.5 truncate text-[12px] leading-4 text-fg-subtle">
                  {article.category?.name} · {article.readingTimeMinutes} min
                  read · v{article.version}
                </div>
              </div>
              <span className="shrink-0 rounded-xs border border-accent-soft bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                {article.status === "published"
                  ? "Published"
                  : article.status === "in_review"
                    ? "In Review"
                    : "Draft"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
