"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { slugifyTitle } from "@/lib/editor/draft";

export type CategoryResult = { ok: true } | { ok: false; error: string };

const NAME_LIMIT = 80;

export async function createCategory(rawName: string): Promise<CategoryResult> {
  const allowed = await requireCategoryAdmin();
  if (!allowed.ok) return allowed;

  const name = cleanName(rawName);
  if (!name.ok) return name;

  const taken = await prisma.category.findFirst({
    where: { name: { equals: name.value, mode: "insensitive" } },
    select: { id: true },
  });
  if (taken) return { ok: false, error: "A category with that name already exists." };

  const slug = await uniqueCategorySlug(slugifyTitle(name.value));
  await prisma.category.create({ data: { name: name.value, slug } });
  refreshCategories(slug);
  return { ok: true };
}

export async function renameCategory(slug: string, rawName: string): Promise<CategoryResult> {
  const allowed = await requireCategoryAdmin();
  if (!allowed.ok) return allowed;

  const name = cleanName(rawName);
  if (!name.ok) return name;

  const current = await prisma.category.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!current) return { ok: false, error: "Category not found." };
  if (current.name === name.value) return { ok: true };

  const taken = await prisma.category.findFirst({
    where: {
      slug: { not: slug },
      name: { equals: name.value, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (taken) return { ok: false, error: "A category with that name already exists." };

  await prisma.category.update({ where: { id: current.id }, data: { name: name.value } });
  refreshCategories(slug);
  return { ok: true };
}

export async function deleteCategory(slug: string): Promise<CategoryResult> {
  const allowed = await requireCategoryAdmin();
  if (!allowed.ok) return allowed;

  const current = await prisma.category.findUnique({
    where: { slug },
    select: { id: true, _count: { select: { articles: true } } },
  });
  if (!current) return { ok: false, error: "Category not found." };
  if (current._count.articles > 0) {
    return { ok: false, error: "This category still has articles." };
  }

  await prisma.category.delete({ where: { id: current.id } });
  refreshCategories(slug);
  return { ok: true };
}

async function requireCategoryAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session || !can(session.role, "admin.manage")) {
    return { ok: false, error: "You do not have permission to manage categories." };
  }
  return { ok: true };
}

function cleanName(rawName: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = rawName.trim().replace(/\s+/g, " ");
  if (!value) return { ok: false, error: "Enter a category name." };
  if (value.length > NAME_LIMIT) {
    return { ok: false, error: `Use ${NAME_LIMIT} characters or fewer.` };
  }
  return { ok: true, value };
}

async function uniqueCategorySlug(base: string): Promise<string> {
  let slug = base;
  for (let n = 2; n < 50; n += 1) {
    const found = await prisma.category.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!found) return slug;
    slug = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}

function refreshCategories(slug: string) {
  revalidatePath("/", "layout");
  revalidatePath("/categories");
  revalidatePath(`/categories/${slug}`);
}
