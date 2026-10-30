import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { canOpenArticle, canOpenPublicArticle } from "@/lib/auth/policy";
import { getSession, requestTime } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { articleViewerKey, viewDay } from "@/lib/kb/article-views";
import { passesPageGate } from "@/lib/kb/page-access";
import { effectiveArticleAccess } from "@/lib/queries/page-access";
import { forbidBadOrigin } from "@/lib/security/request-origin";

const VIEWER_COOKIE = "tb_viewer";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const blocked = forbidBadOrigin(request);
  if (blocked) return blocked;
  const { id } = await context.params;
  const article = await prisma.article.findUnique({
    where: { id },
    select: { id: true, status: true, visibility: true, authorId: true },
  });
  if (!article) return new Response(null, { status: 404 });

  const effective = await effectiveArticleAccess(article.id);
  const session = await getSession();
  if (session) {
    if (
      !canOpenArticle(
        session.role,
        session.userId,
        article,
        passesPageGate(session.role, effective),
      )
    ) {
      return new Response(null, { status: 404 });
    }
  } else if (!canOpenPublicArticle(article, effective.mode)) {
    return new Response(null, { status: 404 });
  }
  const jar = await cookies();
  let anonId = jar.get(VIEWER_COOKIE)?.value ?? "";
  if (!session && !anonId) {
    anonId = crypto.randomUUID();
    jar.set(VIEWER_COOKIE, anonId, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 400 * 24 * 60 * 60,
    });
  }

  const day = viewDay(await requestTime());
  const viewerKey = articleViewerKey(session?.userId ?? null, anonId);

  const counted = await prisma.$transaction(async (tx) => {
    const created = await tx.articleView.createMany({
      data: [{ articleId: article.id, viewerKey, day }],
      skipDuplicates: true,
    });
    if (created.count === 0) return false;
    await tx.$executeRaw(
      Prisma.sql`UPDATE "public"."Article" SET "views" = "views" + 1 WHERE "id" = ${article.id}`,
    );
    return true;
  });

  return new Response(null, { status: counted ? 201 : 204 });
}
