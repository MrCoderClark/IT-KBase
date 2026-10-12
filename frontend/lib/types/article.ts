/**
 * Frontend article types — mirrors the Prisma/Pydantic data model
 * (Docs/specs/03-data-model.md) in a shape optimized for rendering.
 *
 * When the Prisma schema lands, these become generated; for now they're
 * hand-authored to unblock the detail view.
 */

export type ArticleStatus = "draft" | "in_review" | "published" | "archived";

export type SectionKind =
  | "overview"
  | "prerequisites"
  | "steps"
  | "verification"
  | "troubleshooting"
  | "related"
  | "custom";

export type CalloutVariant = "info" | "important" | "warning" | "success";

// ---------------------------------------------------------------------------
// Block types
// ---------------------------------------------------------------------------

interface BlockBase {
  id: string;
  order: number;
}

export interface ProseBlock extends BlockBase {
  kind: "prose";
  /** HTML string (simplified from TipTap JSON until the editor lands). */
  content: string;
}

export interface StepBlock extends BlockBase {
  kind: "step";
  stepNumber: number;
  title: string;
  /** HTML string for the step body. */
  content: string;
}

export interface CalloutBlock extends BlockBase {
  kind: "callout";
  variant: CalloutVariant;
  title: string;
  /** HTML string. */
  content: string;
}

export interface CodeBlock extends BlockBase {
  kind: "code";
  language?: string;
  code: string;
}

export interface ImageBlock extends BlockBase {
  kind: "image";
  imageUrl: string;
  imageAlt: string;
}

export interface ChecklistBlock extends BlockBase {
  kind: "checklist";
  items: string[];
}

export type Block =
  | ProseBlock
  | StepBlock
  | CalloutBlock
  | CodeBlock
  | ImageBlock
  | ChecklistBlock;

// ---------------------------------------------------------------------------
// Section & Article
// ---------------------------------------------------------------------------

export interface Section {
  id: string;
  kind: SectionKind;
  title: string;
  order: number;
  blocks: Block[];
}

export interface ArticleAuthor {
  name: string;
  avatarUrl?: string | null;
}

export interface ArticleCategory {
  name: string;
  slug: string;
  color?: string | null;
}

export interface ArticleTag {
  name: string;
  slug: string;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  heroImageUrl: string | null;
  status: ArticleStatus;
  readingTimeMinutes: number;
  version: string;
  category: ArticleCategory | null;
  tags: ArticleTag[];
  author: ArticleAuthor;
  sections: Section[];
  views: number;
  helpful: number;
  notHelpful: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}
