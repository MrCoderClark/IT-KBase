import { Suspense } from "react";
import { ArticleListShell } from "@/components/kb/article-list-shell";
import { TaxonomyHygiene } from "@/components/kb/taxonomy-hygiene";
import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { tagMergeSuggestions } from "@/lib/assistant/taxonomy";
import { getTagUsage } from "@/lib/queries/taxonomy-usage";

export default function TaxonomyPage() {
  return (
    <Suspense
      fallback={
        <ArticleListShell title="Taxonomy" description="Loading tags…" showCreate={false}>
          <div />
        </ArticleListShell>
      }
    >
      <TaxonomyPanel />
    </Suspense>
  );
}

async function TaxonomyPanel() {
  const session = await getSession();
  if (!session || !can(session.role, "admin.manage")) {
    return (
      <ArticleListShell title="Taxonomy" description="Only an admin can open this page." showCreate={false}>
        <p className="text-[13px] text-fg-muted">You do not have permission to manage taxonomy.</p>
      </ArticleListShell>
    );
  }

  const suggestions = tagMergeSuggestions(await getTagUsage());

  return (
    <ArticleListShell
      title="Taxonomy"
      description="Tags that look like duplicates, with the most-used one suggested to keep. Apply a merge from the tag tools — the assistant only suggests."
      showCreate={false}
    >
      <TaxonomyHygiene suggestions={suggestions} />
    </ArticleListShell>
  );
}
