"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { slugifyTitle } from "@/lib/editor/draft";

export type TagResult = { ok: true; slug?: string } | { ok: false; error: string };

const NAME_LIMIT = 80;

export async function createTag(rawName: string): Promise<TagResult> {
  const allowed = await requireTagAdmin();
  if (!allowed.ok) return allowed;

  const name = cleanName(rawName);
  if (!name.ok) return name;

  const taken = await prisma.tag.findFirst({
    where: { name: { equals: name.value, mode: "insensitive" } },
    select: { id: true },
  });
  if (taken) return { ok: false, error: "A tag with that name already exists." };

  const slug = await uniqueTagSlug(slugifyTitle(name.value));
  await prisma.tag.create({ data: { name: name.value, slug } });
  refreshTags(slug);
  return { ok: true, slug };
}

export async function renameTag(slug: string, rawName: string): Promise<TagResult> {
  const allowed = await requireTagAdmin();
  if (!allowed.ok) return allowed;

  const name = cleanName(rawName);
  if (!name.ok) return name;

  const current = await prisma.tag.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!current) return { ok: false, error: "Tag not found." };
  if (current.name === name.value) return { ok: true, slug };

  const taken = await prisma.tag.findFirst({
    where: {
      slug: { not: slug },
      name: { equals: name.value, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (taken) return { ok: false, error: "A tag with that name already exists." };

  await prisma.tag.update({ where: { id: current.id }, data: { name: name.value } });
  refreshTags(slug);
  return { ok: true, slug };
}

export async function deleteTag(slug: string): Promise<TagResult> {
  const allowed = await requireTagAdmin();
  if (!allowed.ok) return allowed;

  const current = await prisma.tag.findUnique({
    where: { slug },
    select: { id: true, _count: { select: { articles: true } } },
  });
  if (!current) return { ok: false, error: "Tag not found." };
  if (current._count.articles > 0) {
    return { ok: false, error: "This tag is still on articles. Merge it first." };
  }

  await prisma.tag.delete({ where: { id: current.id } });
  refreshTags(slug);
  return { ok: true };
}

/** Move every article from `fromSlug` onto `intoSlug`, then delete `fromSlug`. */
export async function mergeTag(fromSlug: string, intoSlug: string): Promise<TagResult> {
  const allowed = await requireTagAdmin();
  if (!allowed.ok) return allowed;

  if (fromSlug === intoSlug) {
    return { ok: false, error: "Pick a different tag to merge into." };
  }

  const [from, into] = await Promise.all([
    prisma.tag.findUnique({ where: { slug: fromSlug }, select: { id: true, name: true } }),
    prisma.tag.findUnique({ where: { slug: intoSlug }, select: { id: true, name: true } }),
  ]);
  if (!from) return { ok: false, error: "Tag not found." };
  if (!into) return { ok: false, error: "Target tag not found." };

  await prisma.$transaction(async (tx) => {
    const links = await tx.articleTag.findMany({
      where: { tagId: from.id },
      select: { articleId: true },
    });
    for (const link of links) {
      const already = await tx.articleTag.findUnique({
        where: {
          articleId_tagId: { articleId: link.articleId, tagId: into.id },
        },
        select: { articleId: true },
      });
      if (already) {
        await tx.articleTag.delete({
          where: {
            articleId_tagId: { articleId: link.articleId, tagId: from.id },
          },
        });
      } else {
        await tx.articleTag.update({
          where: {
            articleId_tagId: { articleId: link.articleId, tagId: from.id },
          },
          data: { tagId: into.id },
        });
      }
    }
    await tx.tag.delete({ where: { id: from.id } });
  });

  refreshTags(fromSlug);
  refreshTags(intoSlug);
  return { ok: true, slug: intoSlug };
}

async function requireTagAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session || !can(session.role, "admin.manage")) {
    return { ok: false, error: "You do not have permission to manage tags." };
  }
  return { ok: true };
}

function cleanName(rawName: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = rawName.trim().replace(/\s+/g, " ");
  if (!value) return { ok: false, error: "Enter a tag name." };
  if (value.length > NAME_LIMIT) {
    return { ok: false, error: `Use ${NAME_LIMIT} characters or fewer.` };
  }
  return { ok: true, value };
}

async function uniqueTagSlug(base: string): Promise<string> {
  let slug = base || "tag";
  for (let n = 2; n < 50; n += 1) {
    const found = await prisma.tag.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!found) return slug;
    slug = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}

function refreshTags(slug: string) {
  revalidatePath("/", "layout");
  revalidatePath("/tags");
  revalidatePath(`/tags/${slug}`);
  revalidatePath("/kb");
}
