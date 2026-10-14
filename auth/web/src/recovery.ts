import { hashEmailToken, newEmailToken, RESET_TOKEN_MS, VERIFY_TOKEN_MS } from "./email-token";
import { passwordProblem } from "./password-policy";
import { isRateLimited, LOGIN_WINDOW_MS, normalizeEmail } from "./session";
import type { AuthStore, PasswordHasher } from "./types";

export type RecoveryMail = {
  to: string;
  kind: "reset_password" | "verify_email";
  token: string;
};

export type RecoveryRequest =
  | { status: "accepted"; mail: RecoveryMail | null }
  | { status: "invalid_email" }
  | { status: "rate_limited" };

/**
 * Always safe to answer "accepted" to the browser. `mail` is only for the
 * server-side sender. A missing account produces no message.
 */
export async function requestPasswordReset(input: {
  store: AuthStore;
  email: string;
  now: Date;
  ip: string | null;
  userAgent: string | null;
}): Promise<RecoveryRequest> {
  const email = normalizeEmail(input.email);
  if (!email) return { status: "invalid_email" };

  const since = new Date(input.now.getTime() - LOGIN_WINDOW_MS);
  const ipKey = `reset-ip:${input.ip ?? "unknown"}`;
  const emailKey = `reset-email:${email}`;
  const [ipCount, emailCount] = await Promise.all([
    input.store.countAttempts(ipKey, since),
    input.store.countAttempts(emailKey, since),
  ]);
  if (isRateLimited(ipCount) || isRateLimited(emailCount)) {
    await input.store.audit({
      identityId: null,
      action: "reset_rate_limited",
      ip: input.ip,
      userAgent: input.userAgent,
    });
    return { status: "rate_limited" };
  }

  await input.store.recordAttempt(ipKey, input.now);
  await input.store.recordAttempt(emailKey, input.now);

  const identity = await input.store.findIdentityByEmail(email);
  if (!identity || identity.disabledAt) {
    await input.store.audit({
      identityId: identity?.id ?? null,
      action: identity ? "reset_disabled" : "reset_unknown",
      ip: input.ip,
      userAgent: input.userAgent,
    });
    return { status: "accepted", mail: null };
  }

  const kind = identity.emailVerified ? "reset_password" : "verify_email";
  const { token, tokenHash } = newEmailToken();
  const ttl = kind === "reset_password" ? RESET_TOKEN_MS : VERIFY_TOKEN_MS;
  await input.store.saveEmailToken({
    identityId: identity.id,
    purpose: kind,
    tokenHash,
    expiresAt: new Date(input.now.getTime() + ttl),
  });
  await input.store.audit({
    identityId: identity.id,
    action: kind === "reset_password" ? "reset_requested" : "verify_requested",
    ip: input.ip,
    userAgent: input.userAgent,
  });

  return { status: "accepted", mail: { to: identity.email, kind, token } };
}

export async function completePasswordReset(input: {
  store: AuthStore;
  hasher: PasswordHasher;
  token: string;
  password: string;
  now: Date;
  ip: string | null;
  userAgent: string | null;
}): Promise<{ ok: true } | { ok: false; error: "invalid" | "weak"; message?: string }> {
  const problem = passwordProblem(input.password);
  if (problem) return { ok: false, error: "weak", message: problem };

  const record = await input.store.findEmailToken(hashEmailToken(input.token));
  if (
    !record ||
    record.purpose !== "reset_password" ||
    record.usedAt ||
    record.expiresAt.getTime() <= input.now.getTime()
  ) {
    return { ok: false, error: "invalid" };
  }

  const consumed = await input.store.consumeEmailToken(record.id, input.now);
  if (!consumed) return { ok: false, error: "invalid" };

  const passwordHash = await input.hasher.hash(input.password);
  await input.store.setPasswordAndRevokeSessions(record.identityId, passwordHash, input.now);
  await input.store.audit({
    identityId: record.identityId,
    action: "password_reset",
    ip: input.ip,
    userAgent: input.userAgent,
  });
  return { ok: true };
}

export async function completeEmailVerification(input: {
  store: AuthStore;
  token: string;
  now: Date;
  ip: string | null;
  userAgent: string | null;
}): Promise<{ ok: true } | { ok: false; error: "invalid" }> {
  const record = await input.store.findEmailToken(hashEmailToken(input.token));
  if (
    !record ||
    record.purpose !== "verify_email" ||
    record.usedAt ||
    record.expiresAt.getTime() <= input.now.getTime()
  ) {
    return { ok: false, error: "invalid" };
  }

  const consumed = await input.store.consumeEmailToken(record.id, input.now);
  if (!consumed) return { ok: false, error: "invalid" };

  await input.store.markEmailVerified(record.identityId, input.now);
  await input.store.audit({
    identityId: record.identityId,
    action: "email_verified",
    ip: input.ip,
    userAgent: input.userAgent,
  });
  return { ok: true };
}
