/**
 * Per-user assistant rate limit (spec 20 §8): 60 messages/hour, 300/day, in
 * Redis (`rate:{userId}:assistant:{window}`). Fails open when Redis is not
 * configured — the assistant still works in local dev without a limiter.
 */

import { getRedis } from "@/lib/redis";

const WINDOWS = [
  { name: "hour", seconds: 3_600, limit: 60 },
  { name: "day", seconds: 86_400, limit: 300 },
] as const;

export type RateDecision = { ok: true } | { ok: false; retryAfter: number; limit: number };

export async function checkAssistantRate(userId: string): Promise<RateDecision> {
  const redis = getRedis();
  if (!redis) return { ok: true };

  for (const window of WINDOWS) {
    const key = `rate:${userId}:assistant:${window.name}`;
    let count: number;
    try {
      count = await redis.incr(key);
      if (count === 1) await redis.expire(key, window.seconds);
    } catch {
      return { ok: true }; // Redis hiccup must not wall off the assistant.
    }
    if (count > window.limit) {
      let ttl: number = window.seconds;
      try {
        const remaining = await redis.ttl(key);
        if (remaining > 0) ttl = remaining;
      } catch {
        // keep the window default
      }
      return { ok: false, retryAfter: ttl, limit: window.limit };
    }
  }
  return { ok: true };
}
