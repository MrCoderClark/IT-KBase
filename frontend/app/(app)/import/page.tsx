import { Suspense } from "react";

export const maxDuration = 180;
import { AccessDenied } from "@/components/auth/access-denied";
import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { ImportForm } from "./_components/import-form";

export default function ImportPage() {
  return (
    <Suspense
      fallback={<div className="px-6 py-10 text-[13px] text-fg-subtle">Loading import…</div>}
    >
      <ImportBody />
    </Suspense>
  );
}

async function ImportBody() {
  const session = await getSession();
  if (!session || !can(session.role, "article.create")) {
    return (
      <AccessDenied
        title="You cannot import articles"
        detail="Your role can read the knowledge base. An author, reviewer, or admin can turn a Word document or a PDF into a draft."
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-5">
      <h1 className="text-[22px] leading-7 font-bold tracking-tight text-fg">Import from file</h1>
      <p className="mt-0.5 max-w-[640px] text-[13px] leading-5 text-fg-subtle">
        A Word document or a text PDF becomes a draft you can edit. A scanned page is noted and left unread.
      </p>
      <div className="mt-4">
        <ImportForm />
      </div>
    </div>
  );
}
