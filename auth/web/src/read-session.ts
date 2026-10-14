import { hashSessionSecret, nextIdle, sessionIsActive } from "./session";
import type { AuthStore, SessionRecord } from "./types";

export type ActiveSession = {
  sessionId: string;
  identityId: string;
};

export async function resolveSession(
  store: AuthStore,
  secret: string | undefined,
  now: Date,
): Promise<ActiveSession | null> {
  if (!secret) return null;
  const record = await store.findSessionBySecretHash(hashSessionSecret(secret));
  if (!record || !sessionIsActive(record, now)) return null;
  await store.touchSession(record.id, nextIdle(now, record.expiresAt));
  return { sessionId: record.id, identityId: record.identityId };
}

export async function revokePresentedSession(
  store: AuthStore,
  secret: string | undefined,
  now: Date,
): Promise<SessionRecord | null> {
  if (!secret) return null;
  const record = await store.findSessionBySecretHash(hashSessionSecret(secret));
  if (!record || record.revokedAt) return record;
  await store.revokeSession(record.id, now);
  await store.audit({
    identityId: record.identityId,
    action: "logout",
    ip: null,
    userAgent: null,
  });
  return record;
}
