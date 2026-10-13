/**
 * Editor draft shape. Plain JSON so it can cross the server-action boundary.
 * TipTap comes later; this slice edits the five template section kinds with fields.
 */

import type {
  Article,
  ArticleStatus,
  Block,
  CalloutVariant,
  Section,
  SectionKind,
} from "@/lib/types/article";

export const EDITABLE_KINDS = [
  "overview",
  "prerequisites",
  "steps",
  "verification",
  "troubleshooting",
] as const;

export type EditableKind = (typeof EDITABLE_KINDS)[number];

export const CALLOUT_VARIANTS: CalloutVariant[] = [
  "info",
  "important",
  "warning",
  "success",
];

export interface EditorCallout {
  variant: CalloutVariant;
  title: string;
  body: string;
}

export interface EditorStep {
  title: string;
  body: string;
  code: string;
  language: string;
}

export type EditorSection =
  | {
      kind: "overview";
      title: string;
      prose: string;
      callout: EditorCallout | null;
    }
  | { kind: "prerequisites"; title: string; items: string[] }
  | { kind: "steps"; title: string; steps: EditorStep[] }
  | {
      kind: "verification";
      title: string;
      items: string[];
      code: string;
      language: string;
    }
  | { kind: "troubleshooting"; title: string; callouts: EditorCallout[] };

export interface EditorDraft {
  /** Null when creating. Stable on edit so the URL does not change. */
  slug: string | null;
  title: string;
  summary: string;
  categorySlug: string | null;
  tagSlugs: string[];
  status: ArticleStatus;
  sections: EditorSection[];
}

const DEFAULT_TITLES: Record<EditableKind, string> = {
  overview: "Overview",
  prerequisites: "Prerequisites",
  steps: "Step-by-Step Instructions",
  verification: "Verification",
  troubleshooting: "Troubleshooting",
};

export function isEditableKind(kind: SectionKind): kind is EditableKind {
  return (EDITABLE_KINDS as readonly string[]).includes(kind);
}

export function defaultSection(kind: EditableKind): EditorSection {
  switch (kind) {
    case "overview":
      return { kind, title: DEFAULT_TITLES.overview, prose: "", callout: null };
    case "prerequisites":
      return { kind, title: DEFAULT_TITLES.prerequisites, items: [""] };
    case "steps":
      return {
        kind,
        title: DEFAULT_TITLES.steps,
        steps: [{ title: "", body: "", code: "", language: "powershell" }],
      };
    case "verification":
      return {
        kind,
        title: DEFAULT_TITLES.verification,
        items: [""],
        code: "",
        language: "powershell",
      };
    case "troubleshooting":
      return {
        kind,
        title: DEFAULT_TITLES.troubleshooting,
        callouts: [{ variant: "warning", title: "", body: "" }],
      };
  }
}

export function blankDraft(): EditorDraft {
  return {
    slug: null,
    title: "",
    summary: "",
    categorySlug: null,
    tagSlugs: [],
    status: "draft",
    sections: EDITABLE_KINDS.map(defaultSection),
  };
}

export function articleToDraft(article: Article): EditorDraft {
  const sections = [...article.sections]
    .filter((section) => isEditableKind(section.kind))
    .sort((a, b) => a.order - b.order)
    .map(sectionToEditor);

  return {
    slug: article.slug,
    title: article.title,
    summary: article.summary ?? "",
    categorySlug: article.category?.slug ?? null,
    tagSlugs: article.tags.map((tag) => tag.slug),
    status: article.status,
    sections,
  };
}

function sectionToEditor(section: Section): EditorSection {
  switch (section.kind) {
    case "overview": {
      const prose = section.blocks
        .filter((block): block is Extract<Block, { kind: "prose" }> => block.kind === "prose")
        .map((block) => htmlToEditorText(block.content))
        .join("\n\n");
      const calloutBlock = section.blocks.find(
        (block): block is Extract<Block, { kind: "callout" }> => block.kind === "callout",
      );
      return {
        kind: "overview",
        title: section.title,
        prose,
        callout: calloutBlock
          ? {
              variant: calloutBlock.variant,
              title: calloutBlock.title,
              body: htmlToEditorText(calloutBlock.content),
            }
          : null,
      };
    }
    case "prerequisites":
      return {
        kind: "prerequisites",
        title: section.title,
        items: checklistItems(section.blocks),
      };
    case "steps":
      return { kind: "steps", title: section.title, steps: stepsFromBlocks(section.blocks) };
    case "verification": {
      const code = section.blocks.find(
        (block): block is Extract<Block, { kind: "code" }> => block.kind === "code",
      );
      return {
        kind: "verification",
        title: section.title,
        items: checklistItems(section.blocks),
        code: code?.code ?? "",
        language: code?.language ?? "powershell",
      };
    }
    case "troubleshooting":
      return {
        kind: "troubleshooting",
        title: section.title,
        callouts: section.blocks
          .filter((block): block is Extract<Block, { kind: "callout" }> => block.kind === "callout")
          .map((block) => ({
            variant: block.variant,
            title: block.title,
            body: htmlToEditorText(block.content),
          })),
      };
    default:
      return defaultSection("overview");
  }
}

/** Undo the simple paragraphs the editor writes, so the form shows text instead of tags. */
function htmlToEditorText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || /<(ol|ul|li|h[1-6])\b/i.test(trimmed)) return value;
  if (!/^<p>[\s\S]*<\/p>$/.test(trimmed)) return value;
  return trimmed
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<\/?p>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function checklistItems(blocks: Block[]): string[] {
  const items = blocks
    .filter((block): block is Extract<Block, { kind: "checklist" }> => block.kind === "checklist")
    .flatMap((block) => block.items);
  return items.length > 0 ? items : [""];
}

function stepsFromBlocks(blocks: Block[]): EditorStep[] {
  const steps: EditorStep[] = [];
  for (const block of blocks) {
    if (block.kind === "step") {
      steps.push({
        title: block.title,
        body: htmlToEditorText(block.content),
        code: "",
        language: "powershell",
      });
      continue;
    }
    const last = steps[steps.length - 1];
    if (!last) continue;
    if (block.kind === "code" && !last.code) {
      last.code = block.code;
      last.language = block.language ?? "powershell";
    } else if (block.kind === "prose") {
      const text = htmlToEditorText(block.content);
      last.body = last.body ? `${last.body}\n${text}` : text;
    }
  }
  return steps.length > 0
    ? steps
    : [{ title: "", body: "", code: "", language: "powershell" }];
}

export interface DraftIssue {
  sectionIndex: number;
  calloutIndex: number;
  message: string;
}

/** A callout with only a title or only a body cannot be saved. Blank cards are ignored. */
export function calloutIssues(draft: EditorDraft): DraftIssue[] {
  const issues: DraftIssue[] = [];

  draft.sections.forEach((section, sectionIndex) => {
    const callouts: EditorCallout[] =
      section.kind === "troubleshooting"
        ? section.callouts
        : section.kind === "overview" && section.callout
          ? [section.callout]
          : [];

    callouts.forEach((callout, calloutIndex) => {
      const title = callout.title.trim();
      const body = callout.body.trim();
      if (!title && !body) return;
      const where = section.title.trim() || "Callout";
      if (!title) {
        issues.push({
          sectionIndex,
          calloutIndex,
          message: `${where}: callout title is required.`,
        });
      }
      if (!body) {
        issues.push({
          sectionIndex,
          calloutIndex,
          message: `${where}: callout body is required.`,
        });
      }
    });
  });

  return issues;
}

export function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "untitled";
}
