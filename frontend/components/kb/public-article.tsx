import Link from "next/link";
import { BrandMark } from "@/components/brand/brand-mark";
import { ArticleContent } from "@/components/kb/article-content";
import { RecordArticleView } from "@/components/kb/record-article-view";
import { ArticleToc } from "@/components/kb/article-toc";
import type { Article } from "@/lib/types/article";

/**
 * Anonymous read view. No sidebar, no edit or share, no links to other articles.
 */
export function PublicArticle({ article }: { article: Article }) {
  return (
    <div className="min-h-screen bg-canvas text-fg">
      <RecordArticleView articleId={article.id} />
      <header className="border-b border-white/10 bg-[#0B1220] text-white">
        <div className="mx-auto flex h-14 max-w-[1100px] items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <BrandMark size={28} />
            <div>
              <div className="text-[15px] leading-5 font-semibold">TechBase</div>
              <div className="text-[11px] leading-4 text-white/65">Public article</div>
            </div>
          </div>
          <Link href="/login" className="text-[13px] font-semibold text-white hover:text-white/80">
            Sign in
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1100px] px-6 py-8">
        <p className="text-[11px] leading-4 font-semibold tracking-[0.08em] uppercase text-fg-subtle">
          Public
        </p>
        <h1 className="mt-2 text-[28px] leading-9 font-bold tracking-tight text-fg">{article.title}</h1>
        {article.summary ? (
          <p className="mt-3 max-w-[720px] text-[15px] leading-6 text-fg-muted">{article.summary}</p>
        ) : null}
        <div className="mt-8 flex items-start gap-8">
          <ArticleToc sections={article.sections} />
          <ArticleContent article={article} />
        </div>
      </main>
    </div>
  );
}
