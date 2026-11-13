/**
 * BFF for the reviewer's "feedback digest" (spec 20 §3.3 C4). Gates to reviewer+
 * (feedback review), rate-limits, and collects the article's not-helpful comments
 * server-side — the client sends only the articleId, never the comments. Returns
 * themes + suggested edits; it is informational and changes nothing.
 */

import { canReviewArticleFeedback } from "@/lib/auth/policy";
import { mintIngestionAssertion } from "@/lib/auth/assertion";
import { checkAssistantRate } from "@/lib/assistant/rate-limit";
import {
  requestFeedbackDigest,
  FeedbackDigestError,
} from "@/lib/assistant/feedback-digest-client";
import { getSession } from "@/lib/auth/session";
import { listArticleFeedback } from "@/lib/queries/feedback";
import { prisma } from "@/lib/db";

export const maxDuration = 180;

type Body = { articleId?: string };

const MAX_COMMENTS = 200;

export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  if (!canReviewArticleFeedback(session.role)) {
    return Response.json({ error: "You do not have permission to do that." }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const articleId = (body.articleId ?? "").trim();
  if (!articleId) return Response.json({ error: "An article is required." }, { status: 400 });

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { title: true },
  });
  if (!article) return Response.json({ error: "That article was not found." }, { status: 404 });

  const notes = await listArticleFeedback(articleId);
  const comments = notes
    .filter((note) => !note.helpful)
    .map((note) => (note.comment ?? "").trim())
    .filter((comment) => comment.length > 0)
    .slice(0, MAX_COMMENTS);

  const rate = await checkAssistantRate(session.userId);
  if (!rate.ok) {
    return Response.json(
      { error: "You've reached the assistant limit. Try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    );
  }

  const assertion = await mintIngestionAssertion(session, new Date());
  if (!assertion) {
    return Response.json({ error: "The AI Assistant is not configured." }, { status: 503 });
  }

  try {
    const result = await requestFeedbackDigest({ title: article.title, comments, assertion });
    return Response.json(result);
  } catch (err) {
    const message =
      err instanceof FeedbackDigestError
        ? err.message
        : "The assistant could not digest this feedback.";
    const status = /not configured/.test(message) ? 503 : 502;
    return Response.json({ error: message }, { status });
  }
}
