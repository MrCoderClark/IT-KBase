import { cn } from "@/lib/utils";

/**
 * Category pill — accent-soft bg, accent text.
 * Matches the "Windows" chip in the mock's title block.
 */
export function CategoryChip({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-xs bg-accent-soft px-2.5 py-0.5 text-[12px] font-semibold leading-4 text-accent",
        className,
      )}
    >
      {name}
    </span>
  );
}
