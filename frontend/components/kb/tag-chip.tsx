import { cn } from "@/lib/utils";

/**
 * Tag pill — accent-soft bg, accent text, subtle outline.
 * Used in the right rail's Article Details card and inline tag lists.
 */
export function TagChip({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-xs bg-accent-soft px-2 py-0.5 text-[11px] font-semibold leading-4 text-accent",
        className,
      )}
    >
      {name}
    </span>
  );
}
