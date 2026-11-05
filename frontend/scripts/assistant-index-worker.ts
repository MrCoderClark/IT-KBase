/**
 * BullMQ worker that rebuilds assistant chunks for an article after its
 * current version changes (spec 20 §5.2). Enqueued by scheduleReindex.
 *
 *   cd frontend
 *   pnpm worker:assistant-index
 */

import { context } from "@opentelemetry/api";
import { Worker } from "bullmq";
import { INDEX_QUEUE_NAME, type IndexJobData } from "../lib/assistant/index-queue";
import { reindexArticle } from "../lib/assistant/indexer";
import { contextFromCarrier, ensureIngestOtel } from "../lib/otel/ingest";
import { getRedis, redisConfigured } from "../lib/redis";
import { loadEnvFiles } from "./load-env";

loadEnvFiles();
ensureIngestOtel();

async function main() {
  if (!redisConfigured()) {
    console.error("REDIS_URL is required for the assistant index worker.");
    process.exit(1);
  }
  const redis = getRedis();
  if (!redis) {
    console.error("Could not connect Redis.");
    process.exit(1);
  }

  const worker = new Worker<IndexJobData>(
    INDEX_QUEUE_NAME,
    async (job) => {
      const { articleId, actorUserId, traceparent, tracestate } = job.data;
      const parent = contextFromCarrier({ traceparent, tracestate });
      const result = await context.with(parent, () => reindexArticle(articleId, actorUserId));
      console.info(JSON.stringify({ event: "assistant.index.done", ...result }));
    },
    {
      connection: redis.duplicate(),
      concurrency: Number(process.env.ASSISTANT_INDEX_CONCURRENCY ?? 2),
    },
  );

  worker.on("failed", (job, err) => {
    console.error(
      JSON.stringify({
        event: "assistant.index.failed",
        articleId: job?.data.articleId,
        error: err.message,
      }),
    );
  });

  console.info(
    JSON.stringify({ event: "assistant.index.ready", queue: INDEX_QUEUE_NAME }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
