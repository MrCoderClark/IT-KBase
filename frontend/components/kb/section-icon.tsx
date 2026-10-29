import {
  BookOpen,
  CircleCheck,
  ClipboardCheck,
  Link2,
  ListOrdered,
  Wrench,
  FileText,
} from "lucide-react";
import type { SectionKind } from "@/lib/types/article";
import { cn } from "@/lib/utils";

const SECTION_ICONS: Record<
  SectionKind,
  { icon: typeof BookOpen; label: string }
> = {
  overview: { icon: BookOpen, label: "Overview" },
  prerequisites: { icon: ClipboardCheck, label: "Prerequisites" },
  steps: { icon: ListOrdered, label: "Step-by-Step Instructions" },
  verification: { icon: CircleCheck, label: "Verification" },
  troubleshooting: { icon: Wrench, label: "Troubleshooting" },
  related: { icon: Link2, label: "Related Articles" },
  custom: { icon: FileText, label: "Section" },
};

/**
 * Tinted icon tile for article sections.
 * A 32×32 rounded square with a soft accent bg and accent stroke.
 */
export function SectionIcon({
  kind,
  size = 32,
  iconSize = 16,
  className,
}: {
  kind: SectionKind;
  size?: number;
  iconSize?: number;
  className?: string;
}) {
  const { icon: Icon } = SECTION_ICONS[kind];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-sm bg-accent-soft text-accent",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Icon size={iconSize} strokeWidth={2} aria-hidden />
    </span>
  );
}

/** Get the Lucide icon component for a section kind without the tile. */
export function getSectionMeta(kind: SectionKind) {
  return SECTION_ICONS[kind];
}
