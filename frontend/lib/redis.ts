import Redis from "ioredis";

let client: Redis | null | undefined;

/** Shared Redis connection. `null` when REDIS_URL is unset (in-process ingest fallback). */
export function getRedis(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    client = null;
    return null;
  }
  client = new Redis(url, {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: true,
  });
  return client;
}

export function redisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL?.trim());
}
