/**
 * Server-side article queries — Prisma → frontend Article type.
 *
 * These run in Server Components only. Never import from client components.
 */

import { Prisma } from "@prisma/client";
import { can, type Role } from "@/lib/auth/policy";
import { resolveAvatarSrc } from "@/lib/avatar/gravatar";
import { prisma } from "@/lib/db";
import {
  type ArticleFacetFilters,
  updatedWithinCutoff,
} from "@/lib/kb/article-filters";
import { relatedSearchText } from "@/lib/kb/related";
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

async function listOpenArticles(
  role: Role,
  userId: string,
  where?: Prisma.ArticleWhereInput,
): Promise<Article[]> {
  const { filterArticlesByPageAccess } = await import("@/lib/queries/page-access");
  return filterArticlesByPageAccess(role, userId, await listArticles(where));
}

/** Articles this role may see (no sections/blocks loaded). */
export async function getAllArticles(
  role: Role,
  userId: string,
  filters?: ArticleFacetFilters | null,
): Promise<Article[]> {
  return listOpenArticles(role, userId, facetWhere(readableWhere(role, userId), filters));
}

/** AND category / status / updated-within onto a visibility where-clause. */
function facetWhere(
  base: Prisma.ArticleWhereInput,
  filters?: ArticleFacetFilters | null,
): Prisma.ArticleWhereInput {
  if (!filters) return base;
  const parts: Prisma.ArticleWhereInput[] = [base];
  if (filters.category) parts.push({ category: { slug: filters.category } });
  if (filters.status) parts.push({ status: filters.status });
  if (filters.updated) {
    parts.push({ updatedAt: { gte: updatedWithinCutoff(filters.updated) } });
  }
  return parts.length === 1 ? base : { AND: parts };
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
  return listOpenArticles(role, userId, libraryWhere(role, userId));
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
  const [published, drafts, inReview, recent] = await Promise.all([
    prisma.article.count({ where: { status: "published" } }),
    prisma.article.count({ where: { status: "draft", authorId: userId } }),
    can(role, "article.editOwn") || can(role, "article.editAny")
      ? prisma.article.count({ where: inReviewWhere })
      : Promise.resolve(0),
    listOpenArticles(role, userId, libraryWhere(role, userId)).then((rows) => rows.slice(0, 5)),
  ]);
  return {
    published,
    drafts,
    inReview,
    recent,
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

type RelatedRow = { title: string; slug: string };

/**
 * Up to four published articles for the right rail.
 * Rank by FTS against the current title, tags, and summary (same-category
 * boosted). Fill any shortfall with same-category, then other published.
 * Embeddings stay post-pilot.
 */
export async function getRelatedArticles(
  article: {
    slug: string;
    title: string;
    summary: string | null;
    category: { slug: string } | null;
    tags: { name: string }[];
  },
  role?: Role,
  userId?: string,
): Promise<RelatedRow[]> {
  const picked: RelatedRow[] = [];
  const seen = new Set<string>([article.slug]);
  const queryText = relatedSearchText(article);
  const overfetch = role && userId ? RELATED_LIMIT * 3 : RELATED_LIMIT;

  if (queryText) {
    const categorySlug = article.category?.slug ?? "";
    const hasCategory = Boolean(article.category?.slug);
    const ranked = await prisma.$queryRaw<RelatedRow[]>(Prisma.sql`
      WITH q AS (
        SELECT plainto_tsquery('english', ${queryText}) AS query
      )
      SELECT a.title, a.slug
      FROM "public"."Article" a
      CROSS JOIN q
      LEFT JOIN "public"."Category" c ON c.id = a."categoryId"
      WHERE a.status = 'published'
        AND a.slug <> ${article.slug}
        AND numnode(q.query) > 0
        AND a."searchVector" @@ q.query
      ORDER BY
        CASE WHEN ${hasCategory} AND c.slug = ${categorySlug} THEN 1 ELSE 0 END DESC,
        ts_rank(a."searchVector", q.query) DESC,
        a."updatedAt" DESC
      LIMIT ${overfetch}
    `);
    for (const row of ranked) {
      picked.push(row);
      seen.add(row.slug);
    }
  }

  const select = { title: true, slug: true } as const;

  if (picked.length < overfetch && article.category) {
    const sameCategory = await prisma.article.findMany({
      where: {
        status: "published",
        slug: { notIn: [...seen] },
        category: { slug: article.category.slug },
      },
      select,
      orderBy: { updatedAt: "desc" },
      take: overfetch - picked.length,
    });
    for (const row of sameCategory) {
      picked.push(row);
      seen.add(row.slug);
    }
  }

  if (picked.length < overfetch) {
    const filler = await prisma.article.findMany({
      where: {
        status: "published",
        slug: { notIn: [...seen] },
      },
      select,
      orderBy: { updatedAt: "desc" },
      take: overfetch - picked.length,
    });
    picked.push(...filler);
  }

  if (!role || !userId) return picked.slice(0, RELATED_LIMIT);

  const { filterArticlesByPageAccess } = await import("@/lib/queries/page-access");
  const meta = await prisma.article.findMany({
    where: { slug: { in: picked.map((row) => row.slug) } },
    select: { id: true, slug: true, authorId: true, status: true },
  });
  const open = await filterArticlesByPageAccess(role, userId, meta);
  const openSlugs = new Set(open.map((row) => row.slug));
  return picked.filter((row) => openSlugs.has(row.slug)).slice(0, RELATED_LIMIT);
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
    accessMode: "inherit" | "library" | "role_floor";
    accessRoleFloor: "reader" | "author" | "reviewer" | "admin" | null;
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
    accessMode: row.accessMode,
    accessRoleFloor:
      row.accessRoleFloor === "author" ||
      row.accessRoleFloor === "reviewer" ||
      row.accessRoleFloor === "admin"
        ? row.accessRoleFloor
        : null,
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
      color: true,
      _count: { select: { articles: { where: visible } } },
    },
  });
  return rows.map((row) => ({
    name: row.name,
    slug: row.slug,
    color: row.color,
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
  const articles = await listOpenArticles(role, userId, {
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
  const articles = await listOpenArticles(role, userId, {
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
