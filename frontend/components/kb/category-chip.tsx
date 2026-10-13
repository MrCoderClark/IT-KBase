import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Category pill — accent-soft bg, accent text.
 * Matches the "Windows" chip in the mock's title block.
 * Pass `slug` to link to /categories/[slug].
 */
export function CategoryChip({
  name,
  slug,
  className,
}: {
  name: string;
  slug?: string;
  className?: string;
}) {
  const classes = cn(
    "inline-flex items-center rounded-xs bg-accent-soft px-2.5 py-0.5 text-[12px] font-semibold leading-4 text-accent",
    slug && "hover:bg-accent/15",
    className,
  );
  if (!slug) return <span className={classes}>{name}</span>;
  return (
    <Link href={`/categories/${slug}`} className={classes}>
      {name}
    </Link>
  );
}
