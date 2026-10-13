import Link from "next/link";

export function TaxonomyList({
  items,
  emptyTitle,
}: {
  items: { name: string; href: string; count: number }[];
  emptyTitle: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface px-4 py-16 text-center">
        <p className="text-[13px] font-medium text-fg-muted">{emptyTitle}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgba(15,23,42,.06),0_4px_12px_rgba(15,23,42,.04)]">
      {items.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-surface-muted"
          >
            <span className="text-[14px] font-medium text-fg">{item.name}</span>
            <span className="text-[12px] text-fg-subtle tabular-nums">
              {item.count} {item.count === 1 ? "article" : "articles"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
