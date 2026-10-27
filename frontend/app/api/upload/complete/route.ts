import { saveArticle } from "@/lib/actions/save-article";
import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { draftFromStored } from "@/lib/ingestion/parse-docx";
import { keyOwnedBy, safeFileName, sourceKindOf, withinUploadLimit } from "@/lib/ingestion/object-key";

export const maxDuration = 180;

export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  if (!can(session.role, "article.create")) {
    return Response.json({ error: "Your role can read articles. An author, reviewer, or admin can import one." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    key?: unknown;
    originalFileName?: unknown;
    sizeBytes?: unknown;
    sourceKind?: unknown;
  } | null;
  const key = typeof body?.key === "string" ? body.key : "";
  const filename = typeof body?.originalFileName === "string" ? safeFileName(body.originalFileName) : "";
  const sourceKind = sourceKindOf(filename);
  const sizeBytes = typeof body?.sizeBytes === "number" ? Math.floor(body.sizeBytes) : 0;
  if (!sourceKind || body?.sourceKind !== sourceKind) {
    return Response.json({ error: "Only a .docx or .pdf file can be imported." }, { status: 415 });
  }
  if (!withinUploadLimit(sizeBytes)) {
    return Response.json({ error: "That file is larger than 25 MB." }, { status: 413 });
  }
  if (!keyOwnedBy(session.userId, key)) {
    return Response.json({ error: "That file is not in storage." }, { status: 422 });
  }

  const job = await prisma.ingestionJob.create({
    data: {
      sourceKind,
      sourceFileKey: key,
      sourceFileName: filename,
      sizeBytes,
      status: "parsing",
      startedAt: new Date(),
      createdById: session.userId,
    },
  });

  const parsed = await draftFromStored(session, {
    jobId: job.id,
    s3Key: key,
    fileName: filename,
    sourceKind,
    sizeBytes,
  });
  if (!parsed.ok) {
    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: { status: "failed", errorMessage: parsed.error.slice(0, 500), finishedAt: new Date() },
    });
    return Response.json({ error: parsed.error, jobId: job.id }, { status: 422 });
  }

  const saved = await saveArticle(parsed.draft, "patch", `Imported from ${filename}`);
  if (!saved.ok) {
    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: { status: "failed", errorMessage: saved.error.slice(0, 500), finishedAt: new Date() },
    });
    return Response.json({ error: saved.error, jobId: job.id }, { status: 422 });
  }

  const article = await prisma.article.findUnique({
    where: { slug: saved.slug },
    select: { id: true },
  });
  await prisma.ingestionJob.update({
    where: { id: job.id },
    data: {
      status: "succeeded",
      articleId: article?.id,
      finishedAt: new Date(),
    },
  });

  return Response.json({ jobId: job.id, slug: saved.slug });
}
