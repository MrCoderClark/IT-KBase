"use client";

import { useEffect, useState } from "react";
import type { Section } from "@/lib/types/article";
import { SectionIcon } from "@/components/kb/section-icon";
import { cn } from "@/lib/utils";

/**
 * Sticky in-article table of contents (left rail, 220px).
 *
 * Click scrolls to the section with `scroll-margin-top`. Active section
 * is tracked via IntersectionObserver on the section heading elements.
 */
export function ArticleToc({ sections }: { sections: Section[] }) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");

  useEffect(() => {
    const headings = sections
      .map((s) => document.getElementById(s.id))
      .filter(Boolean) as HTMLElement[];

    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0.1 },
    );

    for (const h of headings) observer.observe(h);
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav
      aria-label="Table of contents"
      className="sticky top-24 w-[210px] shrink-0 self-start"
    >
      <ul className="flex flex-col gap-0.5">
        {sections.map((section) => {
          const isActive = activeId === section.id;
          return (
            <li key={section.id}>
                <a
                href={`#${section.id}`}
                className={cn(
                  "flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-[12px] leading-4 font-medium transition-colors",
                  isActive
                    ? "bg-accent-soft text-accent"
                    : "text-fg-muted hover:bg-surface-muted hover:text-fg",
                )}
              >
                <SectionIcon kind={section.kind} size={26} iconSize={13} />
                <span>{section.title}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
