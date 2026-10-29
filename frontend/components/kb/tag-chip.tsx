import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Tag pill — accent-soft bg, accent text, subtle outline.
 * Used in the right rail's Article Details card and inline tag lists.
 * Pass `slug` to link to /tags/[slug].
 */
export function TagChip({
  name,
  slug,
  className,
}: {
  name: string;
  slug?: string;
  className?: string;
}) {
  const classes = cn(
    // min-h-6: WCAG 2.5.8 target size when the chip is a link
    "inline-flex min-h-6 items-center whitespace-nowrap rounded-xs bg-accent-soft px-2 text-[11px] font-semibold leading-4 text-accent",
    slug && "hover:bg-accent/15",
    className,
  );
  if (!slug) return <span className={classes}>{name}</span>;
  return (
    <Link href={`/tags/${slug}`} className={classes}>
      {name}
    </Link>
  );
}
