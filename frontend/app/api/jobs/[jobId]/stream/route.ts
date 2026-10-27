import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { runIngestionJob } from "@/lib/ingestion/run-job";

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

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        for await (const item of runIngestionJob(session, jobId)) {
          send(item.type, item.data);
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
