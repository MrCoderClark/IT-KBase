/**
 * BullMQ queue that rebuilds an article's assistant chunks after its current
 * version changes (spec 20 §5.2). `scheduleReindex` is what server actions
 * call: it enqueues when Redis is configured (the `worker:assistant-index`
 * process does the work), and otherwise rebuilds inline in the background so
 * local dev without a worker still indexes. Indexing is best-effort — a
 * failure is logged and never breaks a publish or restore.
 */

import { Queue } from "bullmq";
import { injectTraceCarrier } from "@/lib/otel/ingest";
import { getRedis, redisConfigured } from "@/lib/redis";

export const INDEX_QUEUE_NAME = "assistant-index";

export type IndexJobData = {
  articleId: string;
  /** User whose assertion embeds the chunks; falls back to an admin. */
  actorUserId?: string;
  traceparent?: string;
  tracestate?: string;
};

let queue: Queue<IndexJobData> | null | undefined;

function indexQueue(): Queue<IndexJobData> | null {
  if (queue !== undefined) return queue;
  const redis = getRedis();
  if (!redis) {
    queue = null;
    return null;
  }
  queue = new Queue<IndexJobData>(INDEX_QUEUE_NAME, {
    connection: redis.duplicate(),
    defaultJobOptions: {
      removeOnComplete: 200,
      removeOnFail: 200,
      attempts: 3,
      backoff: { type: "exponential", delay: 10_000 },
    },
  });
  return queue;
}

export function indexQueueEnabled(): boolean {
  return redisConfigured();
}

/** Enqueue a rebuild. Deduped per article: a pending job is reused. */
export async function enqueueReindex(articleId: string, actorUserId?: string): Promise<boolean> {
  const q = indexQueue();
  if (!q) return false;
  const carrier = injectTraceCarrier();
  await q.add(
    "reindex",
    { articleId, actorUserId, traceparent: carrier.traceparent, tracestate: carrier.tracestate },
    { jobId: `reindex:${articleId}` },
  );
  return true;
}

/**
 * Fire-and-forget reindex for a request path. Prefers the queue; falls back to
 * an inline rebuild in dev. Always resolves — never throws into the caller.
 */
export async function scheduleReindex(articleId: string, actorUserId?: string): Promise<void> {
  try {
    if (await enqueueReindex(articleId, actorUserId)) return;
  } catch (err) {
    logFailure(articleId, err, "enqueue");
  }
  // No queue (or enqueue failed): rebuild in the background.
  void import("./indexer")
    .then(({ reindexArticle }) => reindexArticle(articleId, actorUserId))
    .catch((err) => logFailure(articleId, err, "inline"));
}

function logFailure(articleId: string, err: unknown, phase: string): void {
  console.warn(
    JSON.stringify({
      event: "assistant.index.schedule_failed",
      phase,
      articleId,
      error: err instanceof Error ? err.message : String(err),
    }),
  );
}
