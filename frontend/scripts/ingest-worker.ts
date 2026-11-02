/**
 * BullMQ ingest worker. Picks jobs enqueued by POST /api/upload/complete,
 * runs the Python pipeline via runIngestionJob, and publishes SSE events
 * to Redis stream jobs:{id}:events for GET /api/jobs/{id}/stream.
 *
 *   cd frontend
 *   pnpm worker:ingest
 */

import { Worker } from "bullmq";
import { publishJobEvent, trimJobEvents } from "../lib/ingestion/job-events";
import { INGEST_QUEUE_NAME, type IngestJobData } from "../lib/ingestion/queue";
import { runIngestionJob } from "../lib/ingestion/run-job";
import { appSessionForUserId } from "../lib/ingestion/worker-session";
import { getRedis, redisConfigured } from "../lib/redis";
import { loadEnvFiles } from "./load-env";

loadEnvFiles();

async function main() {
  if (!redisConfigured()) {
    console.error("REDIS_URL is required for the ingest worker.");
    process.exit(1);
  }
  const redis = getRedis();
  if (!redis) {
    console.error("Could not connect Redis.");
    process.exit(1);
  }

  const worker = new Worker<IngestJobData>(
    INGEST_QUEUE_NAME,
    async (job) => {
      const { jobId, userId } = job.data;
      console.info(JSON.stringify({ event: "ingest.worker.start", jobId, userId }));
      const session = await appSessionForUserId(userId);
      if (!session) {
        await publishJobEvent(jobId, {
          type: "failed",
          data: { jobId, code: "session", message: "Import user was not found." },
        });
        return;
      }
      for await (const item of runIngestionJob(session, jobId)) {
        await publishJobEvent(jobId, item);
      }
      await trimJobEvents(jobId, redis);
      console.info(JSON.stringify({ event: "ingest.worker.done", jobId }));
    },
    {
      connection: redis.duplicate(),
      concurrency: Number(process.env.INGEST_WORKER_CONCURRENCY ?? 2),
    },
  );

  worker.on("failed", (job, err) => {
    console.error(
      JSON.stringify({
        event: "ingest.worker.failed",
        jobId: job?.data.jobId,
        error: err.message,
      }),
    );
  });

  console.info(
    JSON.stringify({
      event: "ingest.worker.ready",
      queue: INGEST_QUEUE_NAME,
      concurrency: Number(process.env.INGEST_WORKER_CONCURRENCY ?? 2),
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
