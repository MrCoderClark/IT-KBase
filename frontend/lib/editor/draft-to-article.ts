import type {
  Article,
  Block,
  CalloutVariant,
  Section,
} from "@/lib/types/article";
import type { EditorCallout, EditorDraft, EditorSection, EditorStep } from "@/lib/editor/draft";
import { slugifyTitle } from "@/lib/editor/draft";

/**
 * Map the live editor draft into the Article shape the read view renders.
 * IDs are synthetic; used only for Preview (not persisted).
 */
export function draftToArticle(
  draft: EditorDraft,
  meta: {
    authorName: string;
    categories: { name: string; slug: string }[];
    tags: { name: string; slug: string }[];
  },
): Article {
  const category = draft.categorySlug
    ? (meta.categories.find((item) => item.slug === draft.categorySlug) ?? null)
    : null;
  const tags = draft.tagSlugs
    .map((slug) => meta.tags.find((tag) => tag.slug === slug))
    .filter((tag): tag is { name: string; slug: string } => Boolean(tag));
  const now = new Date().toISOString();
  const sections = draft.sections.map((section, order) =>
    sectionToArticle(section, order),
  );

  return {
    id: "preview",
    slug: draft.slug ?? (slugifyTitle(draft.title) || "untitled"),
    title: draft.title.trim() || "Untitled article",
    summary: draft.summary.trim() || null,
    heroImageUrl: null,
    status: draft.status,
    visibility: draft.visibility,
    readingTimeMinutes: readingMinutes(draft.sections),
    version: draft.version ?? "—",
    category: category
      ? { name: category.name, slug: category.slug }
      : null,
    tags,
    author: { name: meta.authorName },
    sections,
    views: 0,
    helpful: 0,
    notHelpful: 0,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    parentId: draft.parentId,
  };
}

function sectionToArticle(section: EditorSection, order: number): Section {
  const id = `preview-${section.kind}-${order}`;
  return {
    id,
    kind: section.kind,
    title: section.title.trim() || section.kind,
    order,
    blocks: blocksFor(section, id),
  };
}

/** Omit on a union only keeps shared keys; distribute so each variant stays intact. */
type BlockDraft = Block extends infer B
  ? B extends Block
    ? Omit<B, "id" | "order">
    : never
  : never;

function blocksFor(section: EditorSection, sectionId: string): Block[] {
  const blocks: Block[] = [];
  const push = (block: BlockDraft) => {
    blocks.push({
      ...block,
      id: `${sectionId}-b${blocks.length}`,
      order: blocks.length,
    } as Block);
  };

  switch (section.kind) {
    case "overview":
      if (section.prose.trim()) {
        push({ kind: "prose", content: asProse(section.prose) });
      }
      if (section.callout && hasCallout(section.callout)) {
        push(calloutBlock(section.callout));
      }
      break;
    case "prerequisites": {
      const items = filled(section.items);
      if (items.length > 0) push({ kind: "checklist", items });
      break;
    }
    case "steps": {
      const steps = section.steps.filter(hasStep);
      steps.forEach((step, index) => {
        push({
          kind: "step",
          stepNumber: index + 1,
          title: step.title.trim(),
          content: asProse(step.body),
        });
        if (step.code.trim()) {
          push({
            kind: "code",
            code: step.code.replace(/\r\n/g, "\n"),
            language: step.language.trim() || "text",
          });
        }
        for (const image of step.images ?? []) {
          if (image.trim()) {
            push({
              kind: "image",
              imageUrl: image,
              imageAlt: "Screenshot from the Word document",
            });
          }
        }
      });
      break;
    }
    case "verification": {
      const items = filled(section.items);
      if (items.length > 0) push({ kind: "checklist", items });
      if (section.code.trim()) {
        push({
          kind: "code",
          code: section.code.replace(/\r\n/g, "\n"),
          language: section.language.trim() || "text",
        });
      }
      break;
    }
    case "troubleshooting":
      for (const callout of section.callouts) {
        if (hasCallout(callout)) push(calloutBlock(callout));
      }
      break;
  }

  return blocks;
}

function calloutBlock(callout: EditorCallout): Extract<BlockDraft, { kind: "callout" }> {
  return {
    kind: "callout",
    variant: callout.variant as CalloutVariant,
    title: callout.title.trim(),
    content: asProse(callout.body),
  };
}

function asProse(value: string): string {
  const text = value.replace(/\r\n/g, "\n").trim();
  if (!text) return "";
  if (/<\/?(p|ol|ul|li|strong|em|code|br|div|h[1-6])\b/i.test(text)) return text;
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function filled(items: string[]): string[] {
  return items.map((item) => item.trim()).filter(Boolean);
}

function hasCallout(callout: EditorCallout): boolean {
  return Boolean(callout.title.trim() || callout.body.trim());
}

function hasStep(step: EditorStep): boolean {
  return Boolean(
    step.title.trim() || step.body.trim() || step.code.trim() || step.images?.length,
  );
}

function readingMinutes(sections: EditorSection[]): number {
  const words = JSON.stringify(sections).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
