import { Suspense } from "react";
import { ArticleListShell } from "@/components/kb/article-list-shell";
import { CategoryAdmin } from "@/components/kb/category-admin";
import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { getCategoryIndex } from "@/lib/queries/articles";

export default function CategoriesPage() {
  return (
    <Suspense
      fallback={
        <ArticleListShell
          title="Categories"
          description="Browse articles by the system they belong to."
          showCreate={false}
        >
          <ListFallback />
        </ArticleListShell>
      }
    >
      <CategoryIndex />
    </Suspense>
  );
}

async function CategoryIndex() {
  const session = await getSession();
  const categories = session ? await getCategoryIndex(session.role, session.userId) : [];
  return (
    <CategoryAdmin
      categories={categories}
      canManage={Boolean(session && can(session.role, "admin.manage"))}
    />
  );
}

function ListFallback() {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-10 text-center text-[13px] text-fg-subtle">
      Loading categories…
    </div>
  );
}
