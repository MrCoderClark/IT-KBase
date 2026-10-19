import type { Block, Section } from "@/lib/types/article";

export type SectionSide = {
  title: string;
  text: string;
};

export type ComparedSection = {
  status: "unchanged" | "changed" | "only-left" | "only-right";
  left: SectionSide | null;
  right: SectionSide | null;
};

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function blockText(block: Block): string {
  switch (block.kind) {
    case "prose":
      return stripHtml(block.content);
    case "step":
      return [block.title.trim(), stripHtml(block.content)].filter(Boolean).join("\n");
    case "callout":
      return [block.title.trim(), stripHtml(block.content)].filter(Boolean).join("\n");
    case "code":
      return block.code.trim();
    case "checklist":
      return block.items.map((item) => item.trim()).filter(Boolean).join("\n");
    case "image":
      return block.imageAlt.trim();
    default:
      return "";
  }
}

/** Section title plus the plain text of its blocks, in order. */
export function sectionPlainText(section: Section): string {
  const body = [...section.blocks]
    .sort((a, b) => a.order - b.order)
    .map(blockText)
    .filter(Boolean)
    .join("\n\n");
  return [section.title.trim(), body].filter(Boolean).join("\n\n");
}

function side(section: Section): SectionSide {
  return { title: section.title.trim(), text: sectionPlainText(section) };
}

/**
 * Current sections on the left, selected sections on the right.
 * Pairs by position after sorting on `order`. New ids on every save, so this
 * does not treat a moved section as a move.
 */
export function compareSections(current: Section[], selected: Section[]): ComparedSection[] {
  const left = [...current].sort((a, b) => a.order - b.order);
  const right = [...selected].sort((a, b) => a.order - b.order);
  const count = Math.max(left.length, right.length);
  const rows: ComparedSection[] = [];
  for (let i = 0; i < count; i++) {
    const l = left[i];
    const r = right[i];
    if (l && r) {
      const leftSide = side(l);
      const rightSide = side(r);
      rows.push({
        status: leftSide.text === rightSide.text ? "unchanged" : "changed",
        left: leftSide,
        right: rightSide,
      });
    } else if (l) {
      rows.push({ status: "only-left", left: side(l), right: null });
    } else if (r) {
      rows.push({ status: "only-right", left: null, right: side(r) });
    }
  }
  return rows;
}
