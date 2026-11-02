import { Queue } from "bullmq";
import { injectTraceCarrier } from "@/lib/otel/ingest";
import { getRedis, redisConfigured } from "@/lib/redis";

export const INGEST_QUEUE_NAME = "ingest";

export type IngestJobData = {
  jobId: string;
  userId: string;
  /** W3C trace context so the worker continues the enqueue span. */
  traceparent?: string;
  tracestate?: string;
};

let queue: Queue<IngestJobData> | null | undefined;

function ingestQueue(): Queue<IngestJobData> | null {
  if (queue !== undefined) return queue;
  const redis = getRedis();
  if (!redis) {
    queue = null;
    return null;
  }
  queue = new Queue<IngestJobData>(INGEST_QUEUE_NAME, {
    connection: redis.duplicate(),
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 200,
      attempts: 2,
      backoff: { type: "exponential", delay: 5_000 },
    },
  });
  return queue;
}

/** True when REDIS_URL is set — complete enqueues; stream tails Redis; worker must run. */
export function ingestQueueEnabled(): boolean {
  return redisConfigured();
}

/**
 * Enqueue a queued IngestionJob for the Node worker.
 * No-op (returns false) when Redis is not configured — stream route runs in-process.
 */
export async function enqueueIngestJob(jobId: string, userId: string): Promise<boolean> {
  const q = ingestQueue();
  if (!q) return false;
  const carrier = injectTraceCarrier();
  await q.add(
    "ingest",
    {
      jobId,
      userId,
      traceparent: carrier.traceparent,
      tracestate: carrier.tracestate,
    },
    {
      jobId, // dedupe: one BullMQ job per IngestionJob id
    },
  );
  return true;
}
