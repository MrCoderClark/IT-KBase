import { ArticleListShell } from "@/components/kb/article-list-shell";

export default function SharedWithMePage() {
  return (
    <ArticleListShell
      title="Shared With Me"
      description="Articles waiting on your review."
    >
      <div className="rounded-xl border border-border bg-surface px-4 py-16 text-center">
        <p className="text-[13px] font-medium text-fg-muted">Nothing is shared with you yet.</p>
        <p className="mt-0.5 text-[12px] text-fg-subtle">
          Articles sent for review will appear here.
        </p>
      </div>
    </ArticleListShell>
  );
}
