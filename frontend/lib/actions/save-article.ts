"use server";

import { revalidatePath } from "next/cache";
import {
  Prisma,
  type ArticleStatus,
  type BlockKind,
  type CalloutVariant,
  type SectionKind,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  type EditorCallout,
  type EditorDraft,
  type EditorSection,
  type EditorStep,
  calloutIssues,
  slugifyTitle,
} from "@/lib/editor/draft";

const AUTHOR_EMAIL = "joe.clark@techbase.local";

const STATUSES: ArticleStatus[] = ["draft", "in_review", "published", "archived"];

export type SaveResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };

type BlockWrite = {
  kind: BlockKind;
  order: number;
  content?: Prisma.InputJsonValue;
  stepNumber?: number;
  calloutVariant?: CalloutVariant;
  language?: string;
  code?: string;
};

type SectionWrite = {
  kind: SectionKind;
  title: string;
  order: number;
  blocks: BlockWrite[];
};

export async function saveArticle(input: EditorDraft): Promise<SaveResult> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Title is required." };
  const calloutError = calloutIssues(input)[0]?.message;
  if (calloutError) return { ok: false, error: calloutError };
  if (!(STATUSES as string[]).includes(input.status)) {
    return { ok: false, error: "Unknown status." };
  }

  const author = await prisma.user.findUnique({
    where: { email: AUTHOR_EMAIL },
    select: { id: true },
  });
  if (!author) {
    return {
      ok: false,
      error: "Seed user Joe Clark is missing. Run the database seed.",
    };
  }

  const category = input.categorySlug
    ? await prisma.category.findUnique({
        where: { slug: input.categorySlug },
        select: { id: true },
      })
    : null;
  if (input.categorySlug && !category) {
    return { ok: false, error: "Unknown category." };
  }

  const tagSlugs = [...new Set(input.tagSlugs)];
  const tags =
    tagSlugs.length > 0
      ? await prisma.tag.findMany({
          where: { slug: { in: tagSlugs } },
          select: { id: true, slug: true },
        })
      : [];
  if (tags.length !== tagSlugs.length) {
    return { ok: false, error: "One or more tags no longer exist." };
  }

  const existing = input.slug
    ? await prisma.article.findUnique({
        where: { slug: input.slug },
        include: {
          currentVersion: {
            include: {
              sections: {
                orderBy: { order: "asc" },
                include: { blocks: { orderBy: { order: "asc" } } },
              },
            },
          },
        },
      })
    : null;

  if (input.slug && !existing) {
    return { ok: false, error: "Article not found." };
  }

  const slug = existing ? existing.slug : await uniqueSlug(slugifyTitle(title));
  const version = nextVersion(existing?.version ?? null);
  const sections = [
    ...draftSections(input.sections),
    ...preservedSections(existing),
  ].map((section, order) => ({ ...section, order }));

  const articleId = await prisma.$transaction(async (tx) => {
    const article = existing
      ? await tx.article.update({
          where: { id: existing.id },
          data: {
            title,
            summary: input.summary.trim() || null,
            status: input.status,
            categoryId: category?.id ?? null,
            version,
            readingTimeMinutes: readingMinutes(input.sections),
            publishedAt:
              input.status === "published"
                ? (existing.publishedAt ?? new Date())
                : existing.publishedAt,
          },
        })
      : await tx.article.create({
          data: {
            slug,
            title,
            summary: input.summary.trim() || null,
            status: input.status,
            categoryId: category?.id ?? null,
            authorId: author.id,
            version,
            readingTimeMinutes: readingMinutes(input.sections),
            publishedAt: input.status === "published" ? new Date() : null,
          },
        });

    await tx.articleTag.deleteMany({ where: { articleId: article.id } });
    if (tags.length > 0) {
      await tx.articleTag.createMany({
        data: tags.map((tag) => ({ articleId: article.id, tagId: tag.id })),
      });
    }

    const created = await tx.articleVersion.create({
      data: {
        articleId: article.id,
        authorId: author.id,
        version,
        title,
        summary: input.summary.trim() || null,
        notes: "Saved from the editor",
        sections: {
          create: sections.map((section) => ({
            kind: section.kind,
            title: section.title,
            order: section.order,
            blocks: {
              create: section.blocks.map((block) => ({
                kind: block.kind,
                order: block.order,
                ...(block.content !== undefined ? { content: block.content } : {}),
                stepNumber: block.stepNumber ?? null,
                calloutVariant: block.calloutVariant ?? null,
                language: block.language ?? null,
                code: block.code ?? null,
              })),
            },
          })),
        },
      },
    });

    await tx.article.update({
      where: { id: article.id },
      data: { currentVersionId: created.id },
    });
  });

  revalidatePath("/kb");
  revalidatePath(`/kb/${slug}`);
  return { ok: true, slug };
}

function draftSections(sections: EditorSection[]): SectionWrite[] {
  return sections.map((section) => ({
    kind: section.kind,
    title: section.title.trim() || section.kind,
    order: 0,
    blocks: blocksFor(section),
  }));
}

function blocksFor(section: EditorSection): BlockWrite[] {
  const blocks: BlockWrite[] = [];
  const push = (block: Omit<BlockWrite, "order">) => {
    blocks.push({ ...block, order: blocks.length });
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
      if (items.length > 0) push({ kind: "checklist", content: items });
      break;
    }
    case "steps": {
      const steps = section.steps.filter(hasStep);
      steps.forEach((step, index) => {
        push({
          kind: "step",
          stepNumber: index + 1,
          content: { title: step.title.trim(), body: asProse(step.body) },
        });
        if (step.code.trim()) {
          push({
            kind: "code",
            code: step.code.replace(/\r\n/g, "\n"),
            language: step.language.trim() || "text",
          });
        }
      });
      break;
    }
    case "verification": {
      const items = filled(section.items);
      if (items.length > 0) push({ kind: "checklist", content: items });
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

function calloutBlock(callout: EditorCallout): Omit<BlockWrite, "order"> {
  return {
    kind: "callout",
    calloutVariant: callout.variant,
    content: { title: callout.title.trim(), body: asProse(callout.body) },
  };
}

function preservedSections(
  existing: {
    currentVersion: {
      sections: {
        kind: SectionKind;
        title: string;
        blocks: {
          kind: BlockKind;
          content: Prisma.JsonValue;
          stepNumber: number | null;
          calloutVariant: CalloutVariant | null;
          language: string | null;
          code: string | null;
        }[];
      }[];
    } | null;
  } | null,
): SectionWrite[] {
  const sections = existing?.currentVersion?.sections ?? [];
  return sections
    .filter((section) => section.kind === "related" || section.kind === "custom")
    .map((section) => ({
      kind: section.kind,
      title: section.title,
      order: 0,
      blocks: section.blocks.map((block, order) => ({
        kind: block.kind,
        order,
        content: jsonInput(block.content),
        stepNumber: block.stepNumber ?? undefined,
        calloutVariant: block.calloutVariant ?? undefined,
        language: block.language ?? undefined,
        code: block.code ?? undefined,
      })),
    }));
}

function jsonInput(value: Prisma.JsonValue): Prisma.InputJsonValue | undefined {
  if (value === null) return undefined;
  return value as Prisma.InputJsonValue;
}

function asProse(value: string): string {
  const text = value.replace(/\r\n/g, "\n").trim();
  // Keep markup we already stored (lists, paragraphs). Treat other angle brackets as text.
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
  return Boolean(step.title.trim() || step.body.trim() || step.code.trim());
}

function readingMinutes(sections: EditorSection[]): number {
  const words = JSON.stringify(sections).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function nextVersion(current: string | null): string {
  if (!current) return "1.0";
  const match = /^(\d+)\.(\d+)$/.exec(current);
  if (!match) return "1.1";
  return `${match[1]}.${Number(match[2]) + 1}`;
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  for (let n = 2; n < 50; n += 1) {
    const found = await prisma.article.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!found) return slug;
    slug = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}
