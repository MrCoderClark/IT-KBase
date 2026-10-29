import Link from "next/link";
import { categoryLabelColor, categorySoftBackground } from "@/lib/kb/category-color";
import { cn } from "@/lib/utils";

/**
 * Category pill. Uses brand accent by default; optional `color` (#RRGGBB)
 * overrides the tint for that category. Label text is darkened for AA on the soft fill.
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
  const label = custom ? categoryLabelColor(custom) : null;
  const classes = cn(
    // min-h-6: WCAG 2.5.8 target size when the chip is a link
    "inline-flex min-h-6 items-center rounded-xs px-2.5 text-[12px] font-semibold leading-4",
    !custom && "bg-accent-soft text-accent",
    slug && !custom && "hover:bg-accent/15",
    className,
  );
  const style = custom
    ? {
        backgroundColor: soft ?? undefined,
        color: label ?? custom,
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
