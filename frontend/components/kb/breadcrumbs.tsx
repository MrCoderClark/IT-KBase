import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbSegment {
  label: string;
  href?: string;
}

/**
 * Horizontal breadcrumb trail.
 * Last segment is plain text (current page); earlier ones are links.
 */
export function Breadcrumbs({ segments }: { segments: BreadcrumbSegment[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1 text-[13px] leading-5 font-medium text-accent">
        {segments.map((seg, i) => {
          const isLast = i === segments.length - 1;
          return (
            <li key={seg.label} className="flex items-center gap-1">
              {i > 0 && (
                <ChevronRight
                  size={14}
                  className="shrink-0 text-fg-subtle"
                  aria-hidden
                />
              )}
              {seg.href && !isLast ? (
                <Link
                  href={seg.href}
                  className="transition-colors hover:text-accent-hover hover:underline"
                >
                  {seg.label}
                </Link>
              ) : (
                <span className={isLast ? "text-fg-subtle" : ""}>
                  {seg.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
