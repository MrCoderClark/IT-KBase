import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import type { IngestTrace } from "@/lib/ingestion/trace";

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  if (!can(session.role, "article.create")) {
    return Response.json({ error: "You cannot import articles." }, { status: 403 });
  }

  const { jobId } = await context.params;
  const job = await prisma.ingestionJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      status: true,
      sourceFileName: true,
      sourceKind: true,
      sizeBytes: true,
      errorMessage: true,
      trace: true,
      articleId: true,
      startedAt: true,
      finishedAt: true,
      createdAt: true,
      createdById: true,
      article: { select: { slug: true } },
    },
  });
  if (!job || job.createdById !== session.userId) {
    return Response.json({ error: "That import job was not found." }, { status: 404 });
  }

  const trace = (job.trace as IngestTrace | null) ?? null;
  return Response.json({
    jobId: job.id,
    status: job.status,
    sourceFileName: job.sourceFileName,
    sourceKind: job.sourceKind,
    sizeBytes: job.sizeBytes,
    errorMessage: job.errorMessage,
    articleId: job.articleId,
    slug: job.article?.slug ?? null,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    createdAt: job.createdAt,
    trace,
  });
}
