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
  /** Current stored version. Null until the first save. Display only. */
  version: string | null;
  title: string;
  summary: string;
  categorySlug: string | null;
  tagSlugs: string[];
  status: ArticleStatus;
  sections: EditorSection[];
}

export type VersionBump = "patch" | "minor" | "major";

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
    version: null,
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
    version: article.version,
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
      const prose = combineProse(
        section.blocks
          .filter((block): block is Extract<Block, { kind: "prose" }> => block.kind === "prose")
          .map((block) => block.content),
      );
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

/** Keep stored paragraphs and marks together. Plain leftovers stay as text. */
function combineProse(parts: string[]): string {
  const present = parts.map((part) => part.trim()).filter(Boolean);
  if (present.length === 0) return "";
  if (present.every(looksLikeHtml)) return present.join("");
  return present
    .map((part) => (looksLikeHtml(part) ? htmlToEditorText(part) : part))
    .join("\n\n");
}

function looksLikeHtml(value: string): boolean {
  return /<\/?(p|br|strong|em|ul|ol|li)\b/i.test(value);
}

/** Undo the simple paragraphs the editor writes, so a textarea shows text instead of tags. */
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
        body: block.content,
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
      last.body = combineProse([last.body, block.content]);
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

export interface PublishCheck {
  id: "title" | "category" | "tag" | "summary" | "step";
  label: string;
  ok: boolean;
}

/** Gates the Publish action. Save does not use this list. */
export function publishChecks(draft: EditorDraft): PublishCheck[] {
  const steps = draft.sections.find((section) => section.kind === "steps");
  const hasStep =
    steps?.kind === "steps" &&
    steps.steps.some((step) => step.title.trim() || step.body.trim() || step.code.trim());

  return [
    { id: "title", label: "Title", ok: Boolean(draft.title.trim()) },
    { id: "category", label: "Category", ok: Boolean(draft.categorySlug) },
    { id: "tag", label: "At least one tag", ok: draft.tagSlugs.length > 0 },
    { id: "summary", label: "Summary", ok: Boolean(draft.summary.trim()) },
    { id: "step", label: "At least one step", ok: hasStep },
  ];
}

export function publishBlockReason(draft: EditorDraft): string | null {
  const missing = publishChecks(draft).filter((check) => !check.ok);
  if (missing.length === 0) return null;
  return `Publish needs ${missing.map((check) => check.label.toLowerCase()).join(", ")}.`;
}

/** First save is 1.0. Later saves increment the minor number. Major resets it. */
export function nextArticleVersion(current: string | null, bump: VersionBump): string {
  if (!current) return "1.0";
  const match = /^(\d+)\.(\d+)$/.exec(current);
  if (!match) return bump === "major" ? "2.0" : "1.1";
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (bump === "major") return `${major + 1}.0`;
  return `${major}.${minor + 1}`;
}

export function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "untitled";
}
