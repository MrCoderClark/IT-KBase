/**
 * Server-side article queries — Prisma → frontend Article type.
 *
 * These run in Server Components only. Never import from client components.
 */

import type { Prisma } from "@prisma/client";
import { can, type Role } from "@/lib/auth/policy";
import { resolveAvatarSrc } from "@/lib/avatar/gravatar";
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
  visibility: true,
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
  author: { select: { id: true, name: true, email: true, avatarUrl: true } },
} as const;

const versionWithSections = {
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
} as const;

const articleDetailInclude = {
  category: { select: { name: true, slug: true, color: true } },
  tags: {
    select: { tag: { select: { name: true, slug: true } } },
  },
  author: { select: { id: true, name: true, email: true, avatarUrl: true } },
  currentVersion: versionWithSections,
} as const;

const articleEditInclude = {
  ...articleDetailInclude,
  draftVersion: versionWithSections,
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
    visibility: row.visibility,
    readingTimeMinutes: row.readingTimeMinutes,
    version: row.version,
    category: row.category
      ? { name: row.category.name, slug: row.category.slug, color: row.category.color }
      : null,
    tags: row.tags.map((at) => ({ name: at.tag.name, slug: at.tag.slug })),
    author: {
      id: row.author.id,
      name: row.author.name,
      avatarUrl: resolveAvatarSrc(row.author.email, row.author.avatarUrl, 48),
    },
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

/** Rows this role may see. Matches `canReadArticle`. */
export function readableWhere(role: Role, userId: string): Prisma.ArticleWhereInput {
  if (can(role, "article.archive")) return {};
  if (can(role, "article.editAny")) return { status: { not: "archived" } };
  if (can(role, "article.editOwn")) {
    return {
      OR: [
        { status: "published" },
        { authorId: userId, status: { in: ["draft", "in_review"] } },
      ],
    };
  }
  return { status: "published" };
}

function libraryWhere(role: Role, userId: string): Prisma.ArticleWhereInput {
  return { AND: [readableWhere(role, userId), { status: { not: "archived" } }] };
}

async function listArticles(where?: Prisma.ArticleWhereInput): Promise<Article[]> {
  const rows = await prisma.article.findMany({
    where,
    select: articleListSelect,
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(mapListArticle);
}

/** Articles this role may see (no sections/blocks loaded). */
export async function getAllArticles(role: Role, userId: string): Promise<Article[]> {
  return listArticles(readableWhere(role, userId));
}

/** Drafts owned by the signed-in user. */
export async function getMyDrafts(userId: string): Promise<Article[]> {
  return listArticles({
    status: "draft",
    authorId: userId,
  });
}

/** Articles still in the library that this role may see, newest first. */
export async function getRecentlyUpdated(role: Role, userId: string): Promise<Article[]> {
  return listArticles(libraryWhere(role, userId));
}

/** Counts and the newest articles for the home brief. */
export async function getHomeBrief(role: Role, userId: string): Promise<{
  published: number;
  drafts: number;
  inReview: number;
  recent: Article[];
}> {
  const inReviewWhere: Prisma.ArticleWhereInput = can(role, "article.editAny")
    ? { status: "in_review" }
    : { status: "in_review", authorId: userId };
  const [published, drafts, inReview, recentRows] = await Promise.all([
    prisma.article.count({ where: { status: "published" } }),
    prisma.article.count({ where: { status: "draft", authorId: userId } }),
    can(role, "article.editOwn") || can(role, "article.editAny")
      ? prisma.article.count({ where: inReviewWhere })
      : Promise.resolve(0),
    prisma.article.findMany({
      where: libraryWhere(role, userId),
      select: articleListSelect,
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
  ]);
  return {
    published,
    drafts,
    inReview,
    recent: recentRows.map(mapListArticle),
  };
}

export async function getKbNavCounts(role: Role, userId: string): Promise<{
  all: number;
  drafts: number;
  shared: number;
  recent: number;
}> {
  const [all, drafts, recent] = await Promise.all([
    prisma.article.count({ where: readableWhere(role, userId) }),
    can(role, "article.editOwn")
      ? prisma.article.count({ where: { status: "draft", authorId: userId } })
      : Promise.resolve(0),
    prisma.article.count({ where: libraryWhere(role, userId) }),
  ]);
  return { all, drafts, shared: 0, recent };
}

const RELATED_LIMIT = 4;

/**
 * Up to four published articles for the right rail.
 * Same category first, then other published articles.
 */
export async function getRelatedArticles(article: {
  slug: string;
  category: { slug: string } | null;
}): Promise<{ title: string; slug: string }[]> {
  const select = { title: true, slug: true } as const;
  const sameCategory = article.category
    ? await prisma.article.findMany({
        where: {
          status: "published",
          slug: { not: article.slug },
          category: { slug: article.category.slug },
        },
        select,
        orderBy: { updatedAt: "desc" },
        take: RELATED_LIMIT,
      })
    : [];

  if (sameCategory.length >= RELATED_LIMIT) return sameCategory;

  const filler = await prisma.article.findMany({
    where: {
      status: "published",
      slug: { notIn: [article.slug, ...sameCategory.map((row) => row.slug)] },
    },
    select,
    orderBy: { updatedAt: "desc" },
    take: RELATED_LIMIT - sameCategory.length,
  });

  return [...sameCategory, ...filler];
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

  return mapDetailArticle(row, row.currentVersion);
}

/**
 * Editor load: prefer the WIP draftVersion when present so autosaved edits
 * to a published article come back after refresh.
 */
export async function getArticleForEdit(
  slug: string,
): Promise<Article | null> {
  const row = await prisma.article.findUnique({
    where: { slug },
    include: articleEditInclude,
  });

  if (!row) return null;

  const source = row.draftVersion ?? row.currentVersion;
  return mapDetailArticle(row, source, {
    title: source?.title ?? row.title,
    summary: source?.summary ?? row.summary,
  });
}

function mapDetailArticle(
  row: {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    heroImageUrl: string | null;
    status: string;
    visibility: "private" | "public";
    readingTimeMinutes: number;
    version: string;
    category: { name: string; slug: string; color: string | null } | null;
    tags: { tag: { name: string; slug: string } }[];
    author: {
      id: string;
      name: string;
      email: string;
      avatarUrl: string | null;
    };
    views: number;
    helpful: number;
    notHelpful: number;
    createdAt: Date;
    updatedAt: Date;
    publishedAt: Date | null;
    parentId: string | null;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  version: { sections: any[] } | null,
  override?: { title?: string; summary?: string | null },
): Article {
  const sections: Section[] = version?.sections.map(mapSection) ?? [];
  return {
    id: row.id,
    slug: row.slug,
    title: override?.title ?? row.title,
    summary: override?.summary !== undefined ? override.summary : row.summary,
    heroImageUrl: row.heroImageUrl,
    status: row.status as ArticleStatus,
    visibility: row.visibility,
    readingTimeMinutes: row.readingTimeMinutes,
    version: row.version,
    category: row.category
      ? { name: row.category.name, slug: row.category.slug, color: row.category.color }
      : null,
    tags: row.tags.map((at) => ({ name: at.tag.name, slug: at.tag.slug })),
    author: {
      id: row.author.id,
      name: row.author.name,
      // Resolved Gravatar URL — email never leaves the server in this payload.
      avatarUrl: resolveAvatarSrc(row.author.email, row.author.avatarUrl, 48),
    },
    sections,
    views: row.views,
    helpful: row.helpful,
    notHelpful: row.notHelpful,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    parentId: row.parentId,
  };
}

export type ArticleVersionRow = {
  id: string;
  version: string;
  notes: string | null;
  authorName: string;
  createdAt: string;
  current: boolean;
};

/** Newest first. Null when the slug does not exist. */
export async function listArticleVersions(slug: string): Promise<{
  slug: string;
  title: string;
  currentVersion: string;
  versions: ArticleVersionRow[];
} | null> {
  const article = await prisma.article.findUnique({
    where: { slug },
    select: {
      slug: true,
      title: true,
      version: true,
      currentVersionId: true,
      draftVersionId: true,
      versions: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          version: true,
          notes: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      },
    },
  });
  if (!article) return null;
  return {
    slug: article.slug,
    title: article.title,
    currentVersion: article.version,
    versions: article.versions
      .filter(
        (row) =>
          row.version !== "wip" && row.id !== article.draftVersionId,
      )
      .map((row) => ({
        id: row.id,
        version: row.version,
        notes: row.notes,
        authorName: row.author.name,
        createdAt: row.createdAt.toISOString(),
        current: row.id === article.currentVersionId,
      })),
  };
}

/** One saved snapshot, with the live article's category and tags. */
export async function getArticleVersion(
  slug: string,
  version: string,
): Promise<{ article: Article; currentVersion: string; notes: string | null } | null> {
  const row = await prisma.article.findUnique({
    where: { slug },
    include: {
      category: { select: { name: true, slug: true, color: true } },
      tags: { select: { tag: { select: { name: true, slug: true } } } },
      versions: {
        where: { version },
        include: {
          author: { select: { id: true, name: true, email: true, avatarUrl: true } },
          sections: {
            orderBy: { order: "asc" },
            include: { blocks: { orderBy: { order: "asc" } } },
          },
        },
      },
    },
  });
  const snap = row?.versions[0];
  if (!row || !snap) return null;
  return {
    currentVersion: row.version,
    notes: snap.notes,
    article: {
      id: row.id,
      slug: row.slug,
      title: snap.title,
      summary: snap.summary,
      heroImageUrl: row.heroImageUrl,
      status: row.status as ArticleStatus,
      visibility: row.visibility,
      readingTimeMinutes: row.readingTimeMinutes,
      version: snap.version,
      category: row.category
        ? { name: row.category.name, slug: row.category.slug, color: row.category.color }
        : null,
      tags: row.tags.map((at) => ({ name: at.tag.name, slug: at.tag.slug })),
      author: {
        id: snap.author.id,
        name: snap.author.name,
        avatarUrl: resolveAvatarSrc(snap.author.email, snap.author.avatarUrl, 48),
      },
      sections: snap.sections.map(mapSection),
      views: row.views,
      helpful: row.helpful,
      notHelpful: row.notHelpful,
      createdAt: snap.createdAt.toISOString(),
      updatedAt: snap.createdAt.toISOString(),
      publishedAt: row.publishedAt?.toISOString() ?? null,
    },
  };
}

export async function getCategoryIndex(role: Role, userId: string) {
  const visible = readableWhere(role, userId);
  const rows = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: {
      name: true,
      slug: true,
      _count: { select: { articles: { where: visible } } },
    },
  });
  return rows.map((row) => ({
    name: row.name,
    slug: row.slug,
    count: row._count.articles,
  }));
}

export async function getTagIndex(role: Role, userId: string) {
  const visible = readableWhere(role, userId);
  const rows = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    select: {
      name: true,
      slug: true,
      // Tag.articles is the join table. Status lives on the article.
      _count: { select: { articles: { where: { article: visible } } } },
    },
  });
  return rows.map((row) => ({
    name: row.name,
    slug: row.slug,
    count: row._count.articles,
  }));
}

/** Articles in one category. Null when the category slug does not exist. */
export async function getArticlesInCategory(slug: string, role: Role, userId: string) {
  const category = await prisma.category.findUnique({
    where: { slug },
    select: { name: true },
  });
  if (!category) return null;
  const articles = await listArticles({
    AND: [{ category: { slug } }, readableWhere(role, userId)],
  });
  return { name: category.name, articles };
}

/** Articles with one tag. Null when the tag slug does not exist. */
export async function getArticlesWithTag(slug: string, role: Role, userId: string) {
  const tag = await prisma.tag.findUnique({
    where: { slug },
    select: { name: true },
  });
  if (!tag) return null;
  const articles = await listArticles({
    AND: [{ tags: { some: { tag: { slug } } } }, readableWhere(role, userId)],
  });
  return { name: tag.name, articles };
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
