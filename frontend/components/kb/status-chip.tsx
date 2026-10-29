import { cn } from "@/lib/utils";
import type { ArticleStatus } from "@/lib/types/article";

const STATUS_STYLES: Record<
  ArticleStatus,
  { bg: string; text: string; dot: string; label: string }
> = {
  published: {
    bg: "bg-success-soft",
    text: "text-success-fg",
    dot: "bg-success",
    label: "Published",
  },
  draft: {
    bg: "bg-surface-muted",
    text: "text-fg-subtle",
    dot: "bg-fg-subtle",
    label: "Draft",
  },
  in_review: {
    bg: "bg-warning-soft",
    text: "text-warning-fg",
    dot: "bg-warning",
    label: "In Review",
  },
  archived: {
    bg: "bg-surface-muted",
    text: "text-fg-subtle",
    dot: "bg-fg-subtle",
    label: "Archived",
  },
};

/**
 * Status chip with a leading colored dot.
 * "Published" = green, "In Review" = amber, etc.
 */
export function StatusChip({
  status,
  className,
}: {
  status: ArticleStatus;
  className?: string;
}) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-1.5 whitespace-nowrap rounded-pill px-2.5 text-[12px] font-semibold leading-4",
        s.bg,
        s.text,
        className,
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 shrink-0 rounded-full", s.dot)}
        aria-hidden
      />
      {s.label}
    </span>
  );
}
