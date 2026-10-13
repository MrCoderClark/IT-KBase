/**
 * Server-side article queries — Prisma → frontend Article type.
 *
 * These run in Server Components only. Never import from client components.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type {
  Article,
  ArticleStatus,
  Section,
  Block,
  SectionKind,
  CalloutVariant,
} from "@/lib/types/article";

// ---------------------------------------------------------------------------
// Include shape for Prisma queries
// ---------------------------------------------------------------------------

const articleListSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  heroImageUrl: true,
  status: true,
  readingTimeMinutes: true,
  version: true,
  views: true,
  helpful: true,
  notHelpful: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
  category: { select: { name: true, slug: true, color: true } },
  tags: {
    select: { tag: { select: { name: true, slug: true } } },
  },
  author: { select: { name: true, avatarUrl: true } },
} as const;

const articleDetailInclude = {
  category: { select: { name: true, slug: true, color: true } },
  tags: {
    select: { tag: { select: { name: true, slug: true } } },
  },
  author: { select: { name: true, avatarUrl: true } },
  currentVersion: {
    include: {
      sections: {
        orderBy: { order: "asc" as const },
        include: {
          blocks: {
            orderBy: { order: "asc" as const },
          },
        },
      },
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Mappers — Prisma row → frontend rendering type
// ---------------------------------------------------------------------------

type PrismaArticleList = Awaited<
  ReturnType<typeof prisma.article.findMany<{ select: typeof articleListSelect }>>
>[number];

function mapListArticle(row: PrismaArticleList): Article {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    heroImageUrl: row.heroImageUrl,
    status: row.status as ArticleStatus,
    readingTimeMinutes: row.readingTimeMinutes,
    version: row.version,
    category: row.category
      ? { name: row.category.name, slug: row.category.slug, color: row.category.color }
      : null,
    tags: row.tags.map((at) => ({ name: at.tag.name, slug: at.tag.slug })),
    author: { name: row.author.name, avatarUrl: row.author.avatarUrl },
    sections: [],
    views: row.views,
    helpful: row.helpful,
    notHelpful: row.notHelpful,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBlock(b: any): Block {
  switch (b.kind) {
    case "prose":
      return {
        id: b.id,
        kind: "prose",
        order: b.order,
        content: typeof b.content === "string" ? b.content : "",
      };
    case "step": {
      const c = b.content as { title?: string; body?: string } | null;
      return {
        id: b.id,
        kind: "step",
        order: b.order,
        stepNumber: b.stepNumber ?? 0,
        title: c?.title ?? "",
        content: c?.body ?? "",
      };
    }
    case "callout": {
      const c = b.content as
        | { title?: string; body?: string }
        | string
        | null;
      const isObj = typeof c === "object" && c !== null;
      return {
        id: b.id,
        kind: "callout",
        order: b.order,
        variant: (b.calloutVariant as CalloutVariant) ?? "info",
        title: isObj ? (c.title ?? "") : "",
        content: isObj ? (c.body ?? "") : typeof c === "string" ? c : "",
      };
    }
    case "code":
      return {
        id: b.id,
        kind: "code",
        order: b.order,
        language: b.language ?? undefined,
        code: b.code ?? "",
      };
    case "image":
      return {
        id: b.id,
        kind: "image",
        order: b.order,
        imageUrl: b.imageUrl ?? "",
        imageAlt: b.imageAlt ?? "",
      };
    case "checklist": {
      const items = Array.isArray(b.content) ? b.content : [];
      return {
        id: b.id,
        kind: "checklist",
        order: b.order,
        items: items as string[],
      };
    }
    default:
      return {
        id: b.id,
        kind: "prose",
        order: b.order,
        content: typeof b.content === "string" ? b.content : "",
      };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSection(s: any): Section {
  return {
    id: s.id,
    kind: s.kind as SectionKind,
    title: s.title,
    order: s.order,
    blocks: s.blocks.map(mapBlock),
  };
}

// ---------------------------------------------------------------------------
// Public query functions
// ---------------------------------------------------------------------------

/** Stand-in author until sign-in exists. Matches the editor save path. */
const CURRENT_AUTHOR_EMAIL = "joe.clark@techbase.local";

async function listArticles(where?: Prisma.ArticleWhereInput): Promise<Article[]> {
  const rows = await prisma.article.findMany({
    where,
    select: articleListSelect,
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(mapListArticle);
}

/** All articles for the list view (no sections/blocks loaded). */
export async function getAllArticles(): Promise<Article[]> {
  return listArticles();
}

/** Drafts owned by the stand-in author. */
export async function getMyDrafts(): Promise<Article[]> {
  return listArticles({
    status: "draft",
    author: { email: CURRENT_AUTHOR_EMAIL },
  });
}

/** Every article that is still in the library, newest first. */
export async function getRecentlyUpdated(): Promise<Article[]> {
  return listArticles({ status: { not: "archived" } });
}

export async function getKbNavCounts(): Promise<{
  all: number;
  drafts: number;
  shared: number;
  recent: number;
}> {
  const mine = { email: CURRENT_AUTHOR_EMAIL };
  const [all, drafts, recent] = await Promise.all([
    prisma.article.count(),
    prisma.article.count({ where: { status: "draft", author: mine } }),
    prisma.article.count({ where: { status: { not: "archived" } } }),
  ]);
  return { all, drafts, shared: 0, recent };
}

/** Single article by slug with full section + block tree. */
export async function getArticleBySlug(
  slug: string,
): Promise<Article | null> {
  const row = await prisma.article.findUnique({
    where: { slug },
    include: articleDetailInclude,
  });

  if (!row) return null;

  const sections: Section[] =
    row.currentVersion?.sections.map(mapSection) ?? [];

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    heroImageUrl: row.heroImageUrl,
    status: row.status as ArticleStatus,
    readingTimeMinutes: row.readingTimeMinutes,
    version: row.version,
    category: row.category
      ? { name: row.category.name, slug: row.category.slug, color: row.category.color }
      : null,
    tags: row.tags.map((at) => ({ name: at.tag.name, slug: at.tag.slug })),
    author: { name: row.author.name, avatarUrl: row.author.avatarUrl },
    sections,
    views: row.views,
    helpful: row.helpful,
    notHelpful: row.notHelpful,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
  };
}

/** All unique categories (for filter dropdowns). */
export async function getAllCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { name: true, slug: true, color: true },
  });
}

/** All tags, for the editor picker. */
export async function getAllTags() {
  return prisma.tag.findMany({
    orderBy: { name: "asc" },
    select: { name: true, slug: true },
  });
}

/** All article slugs (for generateStaticParams). */
export async function getAllArticleSlugs(): Promise<string[]> {
  const rows = await prisma.article.findMany({
    select: { slug: true },
  });
  return rows.map((r) => r.slug);
}
