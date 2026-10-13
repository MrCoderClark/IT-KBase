import Link from "next/link";
import { Plus } from "lucide-react";

export function ArticleListShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-5">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] leading-7 font-bold tracking-tight text-fg">{title}</h1>
          <p className="mt-0.5 text-[13px] text-fg-subtle">{description}</p>
        </div>
        <Link
          href="/create"
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover"
        >
          <Plus size={15} aria-hidden />
          New Article
        </Link>
      </div>
      {children}
    </div>
  );
}
