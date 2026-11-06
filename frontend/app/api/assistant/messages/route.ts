import { context, trace } from "@opentelemetry/api";
import { askAssistant, type AskInput } from "@/lib/assistant/ask";
import { checkAssistantRate } from "@/lib/assistant/rate-limit";
import { getSession } from "@/lib/auth/session";
import { ensureIngestOtel, ingestTracer } from "@/lib/otel/ingest";

export const maxDuration = 180;

type Body = {
  question?: string;
  scope?: "library" | "article";
  articleId?: string;
  conversationId?: string;
  mode?: "answer" | "eli5" | "command";
};

export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return new Response("Sign in to continue.", { status: 401 });

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return new Response("Invalid request body.", { status: 400 });
  }

  const question = (body.question ?? "").trim();
  if (!question) return new Response("Ask a question.", { status: 400 });
  if (question.length > 4_000) return new Response("That question is too long.", { status: 400 });

  const rate = await checkAssistantRate(session.userId);
  if (!rate.ok) {
    return new Response("You've reached the assistant limit. Try again later.", {
      status: 429,
      headers: { "Retry-After": String(rate.retryAfter) },
    });
  }

  const input: AskInput = {
    session,
    question,
    scope: body.scope === "article" ? "article" : "library",
    articleId: body.articleId,
    conversationId: body.conversationId,
    mode: body.mode ?? "answer",
  };

  ensureIngestOtel();
  const span = ingestTracer().startSpan("assistant.request", {
    attributes: { "tb.scope": input.scope ?? "library" },
  });
  const ctx = trace.setSpan(context.active(), span);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        await context.with(ctx, async () => {
          for await (const item of askAssistant(input)) send(item.type, item.data);
        });
      } catch (err) {
        send("failed", {
          code: "stream",
          message: err instanceof Error ? err.message : "The assistant failed to answer.",
        });
      } finally {
        span.end();
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
