import { createHash, randomBytes } from "node:crypto";

/** 7 days. The cookie cannot outlive this, even if the browser stays open. */
export const SESSION_ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000;

/** 24 hours without a request. Refreshed on each authenticated read. */
export const SESSION_IDLE_MS = 24 * 60 * 60 * 1000;

export const LOGIN_WINDOW_MS = 10 * 60 * 1000;
export const LOGIN_LIMIT = 5;

export type SessionDeadlines = {
  expiresAt: Date;
  idleAt: Date;
};

export function sessionDeadlines(now: Date): SessionDeadlines {
  return {
    expiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_MS),
    idleAt: new Date(now.getTime() + SESSION_IDLE_MS),
  };
}

/** Idle deadline never extends past the absolute expiry. */
export function nextIdle(now: Date, expiresAt: Date): Date {
  const idle = new Date(now.getTime() + SESSION_IDLE_MS);
  return idle.getTime() < expiresAt.getTime() ? idle : expiresAt;
}

export function sessionIsActive(
  session: { expiresAt: Date; idleAt: Date; revokedAt: Date | null },
  now: Date,
): boolean {
  if (session.revokedAt) return false;
  if (session.expiresAt.getTime() <= now.getTime()) return false;
  if (session.idleAt.getTime() <= now.getTime()) return false;
  return true;
}

export function hashSessionSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/** New cookie value and the hash stored in the database. The raw value is never stored. */
export function newSessionSecret(): { secret: string; secretHash: string } {
  const secret = randomBytes(32).toString("base64url");
  return { secret, secretHash: hashSessionSecret(secret) };
}

export function isRateLimited(attemptCount: number): boolean {
  return attemptCount >= LOGIN_LIMIT;
}

export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (email.length < 3 || email.length > 320 || !email.includes("@")) return null;
  return email;
}

/** Relative in-app path only. Anything else returns the home page. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  if (value.includes("://")) return "/";
  return value;
}
