import { cn } from "@/lib/utils";

/**
 * 28×28 filled cobalt circle with a white digit.
 * Used in the Step-by-Step section for numbered steps.
 * Matches 02-design-system.md §6.5.
 */
export function StepBadge({
  number,
  className,
}: {
  number: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[14px] font-semibold tabular-nums text-white",
        className,
      )}
      aria-hidden
    >
      {number}
    </span>
  );
}
