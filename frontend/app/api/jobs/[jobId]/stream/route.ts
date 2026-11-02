import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { readJobEvents } from "@/lib/ingestion/job-events";
import { ingestQueueEnabled } from "@/lib/ingestion/queue";
import { runIngestionJob, type JobStreamEvent } from "@/lib/ingestion/run-job";
import { emptyTrace, type IngestTrace } from "@/lib/ingestion/trace";

export const maxDuration = 180;

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return new Response("Sign in to continue.", { status: 401 });
  if (!can(session.role, "article.create")) {
    return new Response("You cannot import articles.", { status: 403 });
  }

  const { jobId } = await context.params;
  if (!jobId) return new Response("Missing job.", { status: 400 });

  const job = await prisma.ingestionJob.findUnique({ where: { id: jobId } });
  if (!job || job.createdById !== session.userId) {
    return new Response("That import job was not found.", { status: 404 });
  }

  const useQueue = ingestQueueEnabled();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        if (useQueue) {
          for await (const item of queuedOrTerminalEvents(jobId, job)) {
            send(item.type, item.data);
          }
        } else {
          for await (const item of runIngestionJob(session, jobId)) {
            send(item.type, item.data);
          }
        }
      } catch (err) {
        send("failed", {
          jobId,
          code: "stream",
          message: err instanceof Error ? err.message : "The document could not be read.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

async function* queuedOrTerminalEvents(
  jobId: string,
  job: {
    status: string;
    articleId: string | null;
    errorMessage: string | null;
    trace: unknown;
  },
): AsyncGenerator<JobStreamEvent> {
  if (job.status === "succeeded" && job.articleId) {
    const article = await prisma.article.findUnique({
      where: { id: job.articleId },
      select: { slug: true },
    });
    if (article) {
      yield {
        type: "done",
        data: {
          jobId,
          articleId: job.articleId,
          slug: article.slug,
          trace:
            job.trace && typeof job.trace === "object"
              ? (job.trace as IngestTrace)
              : emptyTrace(),
        },
      };
      return;
    }
  }
  if (job.status === "failed") {
    yield {
      type: "failed",
      data: {
        jobId,
        code: "job",
        message: job.errorMessage ?? "Import failed.",
      },
    };
    return;
  }
  yield* readJobEvents(jobId);
}
