import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { canReadArticle, isPublicArticle } from "@/lib/auth/policy";
import { getSession, requestTime } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { articleViewerKey, viewDay } from "@/lib/kb/article-views";

const VIEWER_COOKIE = "tb_viewer";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const article = await prisma.article.findUnique({
    where: { id },
    select: { id: true, status: true, visibility: true, authorId: true },
  });
  if (!article) return new Response(null, { status: 404 });

  const session = await getSession();
  if (session) {
    if (!canReadArticle(session.role, session.userId, article)) {
      return new Response(null, { status: 404 });
    }
  } else if (!isPublicArticle(article)) {
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
