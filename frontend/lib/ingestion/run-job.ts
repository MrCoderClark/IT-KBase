import { saveArticle } from "@/lib/actions/save-article";
import { mintIngestionAssertion } from "@/lib/auth/assertion";
import type { AppSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { jobStatusForStage } from "@/lib/ingestion/stages";
import { parsedToDraft, type ParsedDraft } from "@/lib/ingestion/to-draft";

export type JobProgress = {
  jobId: string;
  stage: string;
  status: string;
  detail: string;
  progress: number;
};

export type JobStreamEvent =
  | { type: "progress"; data: JobProgress }
  | { type: "done"; data: { jobId: string; articleId: string; slug: string } }
  | { type: "failed"; data: { jobId: string; code: string; message: string } };

/** Run the stored file through Python, emit stage events, and save the draft. */
export async function* runIngestionJob(
  session: AppSession,
  jobId: string,
): AsyncGenerator<JobStreamEvent> {
  const job = await prisma.ingestionJob.findUnique({ where: { id: jobId } });
  if (!job || job.createdById !== session.userId) {
    yield { type: "failed", data: { jobId, code: "missing", message: "That import job was not found." } };
    return;
  }

  if (job.status === "succeeded" && job.articleId) {
    const article = await prisma.article.findUnique({
      where: { id: job.articleId },
      select: { slug: true },
    });
    if (article) {
      yield {
        type: "done",
        data: { jobId, articleId: job.articleId, slug: article.slug },
      };
      return;
    }
  }

  if (job.status === "failed") {
    yield {
      type: "failed",
      data: {
        jobId,
        code: "failed",
        message: job.errorMessage || "The document could not be read.",
      },
    };
    return;
  }

  const claimed = await prisma.ingestionJob.updateMany({
    where: {
      id: jobId,
      createdById: session.userId,
      status: { in: ["queued", "failed", "parsing", "extracting", "structuring", "validating"] },
    },
    data: { status: "parsing", startedAt: new Date(), errorMessage: null, finishedAt: null },
  });
  if (claimed.count === 0) {
    yield {
      type: "failed",
      data: { jobId, code: "busy", message: "That import is already finished." },
    };
    return;
  }

  const assertion = await mintIngestionAssertion(session, new Date());
  if (!assertion) {
    await failJob(jobId, "Ingestion is not configured. AUTH_ASSERTION_KEYS has to match the Python service.");
    yield {
      type: "failed",
      data: {
        jobId,
        code: "config",
        message: "Ingestion is not configured. AUTH_ASSERTION_KEYS has to match the Python service.",
      },
    };
    return;
  }

  const base = (process.env.INGESTION_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
  let response: Response;
  try {
    response = await fetch(`${base}/ingest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${assertion}`,
        Accept: "text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jobId: job.id,
        s3Key: job.sourceFileKey,
        fileName: job.sourceFileName,
        sourceKind: job.sourceKind,
        sizeBytes: job.sizeBytes,
      }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    const message = timedOut
      ? "Reading that file took too long. Start the import again."
      : "The ingestion service is not running. Start it from backend/ on port 8080.";
    await failJob(jobId, message);
    yield { type: "failed", data: { jobId, code: "upstream", message } };
    return;
  }

  if (!response.ok || !response.body) {
    const message =
      response.status === 404
        ? "The ingestion service is missing the upload route. Restart it from backend/."
        : "The document could not be read.";
    await failJob(jobId, message);
    yield { type: "failed", data: { jobId, code: "upstream", message } };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let draft: ParsedDraft | null = null;
  let failed: { code: string; message: string } | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const parsed = parseSse(chunk);
      if (!parsed) continue;
      if (parsed.event === "progress") {
        const data = parsed.data as JobProgress;
        await prisma.ingestionJob.update({
          where: { id: jobId },
          data: { status: jobStatusForStage(data.stage) },
        });
        yield { type: "progress", data };
      } else if (parsed.event === "done") {
        const payload = parsed.data as { draft?: ParsedDraft };
        if (payload.draft) draft = payload.draft;
      } else if (parsed.event === "failed") {
        const payload = parsed.data as { code?: string; message?: string };
        failed = {
          code: payload.code || "parse",
          message: payload.message || "The document could not be read.",
        };
      }
    }
  }

  if (failed) {
    await failJob(jobId, failed.message);
    yield { type: "failed", data: { jobId, code: failed.code, message: failed.message } };
    return;
  }

  if (!draft?.title?.trim()) {
    const message = "That document has no text to import.";
    await failJob(jobId, message);
    yield { type: "failed", data: { jobId, code: "empty", message } };
    return;
  }

  const saved = await saveArticle(parsedToDraft(draft), "patch", `Imported from ${job.sourceFileName}`);
  if (!saved.ok) {
    await failJob(jobId, saved.error);
    yield { type: "failed", data: { jobId, code: "save", message: saved.error } };
    return;
  }

  const article = await prisma.article.findUnique({
    where: { slug: saved.slug },
    select: { id: true },
  });
  await prisma.ingestionJob.update({
    where: { id: jobId },
    data: {
      status: "succeeded",
      articleId: article?.id,
      finishedAt: new Date(),
    },
  });

  yield {
    type: "progress",
    data: {
      jobId,
      stage: "done",
      status: "succeeded",
      detail: "Draft ready",
      progress: 1,
    },
  };
  yield {
    type: "done",
    data: { jobId, articleId: article?.id ?? "", slug: saved.slug },
  };
}

async function failJob(jobId: string, message: string): Promise<void> {
  await prisma.ingestionJob.update({
    where: { id: jobId },
    data: {
      status: "failed",
      errorMessage: message.slice(0, 500),
      finishedAt: new Date(),
    },
  });
}

function parseSse(chunk: string): { event: string; data: unknown } | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of chunk.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  try {
    return { event, data: JSON.parse(dataLines.join("\n")) };
  } catch {
    return null;
  }
}
