"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { nextArticleVersion } from "@/lib/editor/draft";
import { restoreRefusal, restoredFromNote } from "@/lib/kb/restore-version";

export async function restoreArticleVersion(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const version = String(formData.get("version") ?? "");
  const back = `/kb/${slug}/history`;
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(back)}`);
  if (!can(session.role, "article.rollback")) redirect(`${back}?e=role`);

  const article = await prisma.article.findUnique({
    where: { slug },
    select: {
      id: true,
      version: true,
      currentVersionId: true,
      versions: {
        where: { version },
        include: {
          sections: {
            orderBy: { order: "asc" },
            include: { blocks: { orderBy: { order: "asc" } } },
          },
        },
      },
    },
  });

  const selected = article?.versions[0] ?? null;
  const refusal = restoreRefusal({
    articleId: article?.id ?? "",
    currentVersionId: article?.currentVersionId ?? null,
    selected: selected ? { id: selected.id, articleId: selected.articleId } : null,
  });
  if (!article || refusal === "missing" || refusal === "other" || !selected) {
    redirect(`${back}?e=missing`);
  }
  if (refusal === "current") redirect(`${back}?e=current`);

  const next = nextArticleVersion(article.version, "minor");
  const words = JSON.stringify(selected.sections).split(/\s+/).filter(Boolean).length;
  const readingTimeMinutes = Math.max(1, Math.round(words / 200));

  try {
    await prisma.$transaction(async (tx) => {
      const created = await tx.articleVersion.create({
        data: {
          articleId: article.id,
          authorId: session.userId,
          version: next,
          title: selected.title,
          summary: selected.summary,
          notes: restoredFromNote(selected.version),
          sections: {
            create: selected.sections.map((section) => ({
              kind: section.kind,
              title: section.title,
              order: section.order,
              blocks: {
                create: section.blocks.map((block) => ({
                  kind: block.kind,
                  order: block.order,
                  content:
                    block.content === null ? undefined : (block.content as Prisma.InputJsonValue),
                  stepNumber: block.stepNumber,
                  calloutVariant: block.calloutVariant,
                  language: block.language,
                  code: block.code,
                  imageUrl: block.imageUrl,
                  imageAlt: block.imageAlt,
                })),
              },
            })),
          },
        },
      });
      await tx.article.update({
        where: { id: article.id },
        data: {
          currentVersionId: created.id,
          version: next,
          title: selected.title,
          summary: selected.summary,
          readingTimeMinutes,
        },
      });
    });
  } catch {
    redirect(`${back}?e=missing`);
  }

  revalidatePath("/kb");
  revalidatePath(`/kb/${slug}`);
  revalidatePath(back);
  redirect(
    `${back}?notice=restored&from=${encodeURIComponent(selected.version)}&to=${encodeURIComponent(next)}`,
  );
}
