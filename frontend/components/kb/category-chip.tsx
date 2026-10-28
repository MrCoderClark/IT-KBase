import Link from "next/link";
import { categorySoftBackground } from "@/lib/kb/category-color";
import { cn } from "@/lib/utils";

/**
 * Category pill. Uses brand accent by default; optional `color` (#RRGGBB)
 * overrides the tint for that category.
 */
export function CategoryChip({
  name,
  slug,
  color,
  className,
}: {
  name: string;
  slug?: string;
  color?: string | null;
  className?: string;
}) {
  const custom = color?.trim() ? color.trim() : null;
  const soft = custom ? categorySoftBackground(custom) : null;
  const classes = cn(
    "inline-flex items-center rounded-xs px-2.5 py-0.5 text-[12px] font-semibold leading-4",
    !custom && "bg-accent-soft text-accent",
    slug && !custom && "hover:bg-accent/15",
    className,
  );
  const style = custom
    ? {
        backgroundColor: soft ?? undefined,
        color: custom,
      }
    : undefined;

  if (!slug) {
    return (
      <span className={classes} style={style}>
        {name}
      </span>
    );
  }
  return (
    <Link href={`/categories/${slug}`} className={classes} style={style}>
      {name}
    </Link>
  );
}
