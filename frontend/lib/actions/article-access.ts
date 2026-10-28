"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  type AccessRoleFloor,
  type ArticleAccessMode,
  isAccessRoleFloor,
} from "@/lib/kb/page-access";

export type SetArticleAccessResult =
  | { ok: true; clearedPublic: boolean }
  | { ok: false; error: string };

/**
 * Set this page's access mode (reviewer/admin). role_floor clears public.
 * Spec: Docs/specs/12-per-page-permissions.md
 */
export async function setArticleAccess(
  articleId: string,
  mode: ArticleAccessMode,
  roleFloor?: AccessRoleFloor | null,
): Promise<SetArticleAccessResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!can(session.role, "article.publish")) {
    return { ok: false, error: "You cannot change page access." };
  }

  if (mode !== "inherit" && mode !== "library" && mode !== "role_floor") {
    return { ok: false, error: "Unknown access mode." };
  }
  if (mode === "role_floor" && !isAccessRoleFloor(roleFloor ?? null)) {
    return { ok: false, error: "Pick Author, Reviewer, or Admin for the floor." };
  }

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { id: true, slug: true, visibility: true },
  });
  if (!article) return { ok: false, error: "Article not found." };

  const clearedPublic = mode === "role_floor" && article.visibility === "public";

  await prisma.article.update({
    where: { id: articleId },
    data: {
      accessMode: mode,
      accessRoleFloor: mode === "role_floor" ? roleFloor : null,
      ...(clearedPublic ? { visibility: "private" } : {}),
    },
  });

  revalidatePath(`/kb/${article.slug}`);
  revalidatePath(`/kb/${article.slug}/edit`);
  revalidatePath("/kb");
  revalidatePath("/");

  return { ok: true, clearedPublic };
}
