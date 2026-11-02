import type { Redis } from "ioredis";
import { getRedis } from "@/lib/redis";
import type { JobStreamEvent } from "@/lib/ingestion/run-job";

export function jobEventsKey(jobId: string): string {
  return `jobs:${jobId}:events`;
}

export async function publishJobEvent(jobId: string, event: JobStreamEvent): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.xadd(
    jobEventsKey(jobId),
    "*",
    "type",
    event.type,
    "data",
    JSON.stringify(event.data),
  );
}

/**
 * Yield events from the Redis stream until `done` / `failed`, or idle timeout
 * while the job is still queued with no worker activity.
 */
export async function* readJobEvents(
  jobId: string,
  opts: { signal?: AbortSignal; idleMs?: number } = {},
): AsyncGenerator<JobStreamEvent> {
  const redis = getRedis();
  if (!redis) {
    throw new Error("REDIS_URL is not configured.");
  }
  const key = jobEventsKey(jobId);
  const idleMs = opts.idleMs ?? 120_000;
  let lastId = "0-0";
  let lastActivity = Date.now();

  while (!opts.signal?.aborted) {
    const result = (await redis.xread(
      "BLOCK",
      2_000,
      "STREAMS",
      key,
      lastId,
    )) as [string, [string, string[]][]][] | null;

    if (!result) {
      if (Date.now() - lastActivity > idleMs) {
        yield {
          type: "failed",
          data: {
            jobId,
            code: "worker",
            message:
              "No ingest worker picked up this job. From frontend/, run: pnpm worker:ingest",
          },
        };
        return;
      }
      continue;
    }

    lastActivity = Date.now();
    for (const [, messages] of result) {
      for (const [id, fields] of messages) {
        lastId = id;
        const map = fieldsToMap(fields);
        const type = map.type as JobStreamEvent["type"] | undefined;
        if (!type || !map.data) continue;
        let data: JobStreamEvent["data"];
        try {
          data = JSON.parse(map.data) as JobStreamEvent["data"];
        } catch {
          continue;
        }
        const event = { type, data } as JobStreamEvent;
        yield event;
        if (type === "done" || type === "failed") return;
      }
    }
  }
}

function fieldsToMap(fields: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i + 1 < fields.length; i += 2) {
    out[fields[i]!] = fields[i + 1]!;
  }
  return out;
}

/** Trim stream after a successful read window (optional GC). */
export async function trimJobEvents(jobId: string, redis?: Redis | null): Promise<void> {
  const client = redis ?? getRedis();
  if (!client) return;
  await client.expire(jobEventsKey(jobId), 60 * 60 * 24);
}
