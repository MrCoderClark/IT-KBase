import { isRateLimited, LOGIN_WINDOW_MS, newSessionSecret, normalizeEmail, sessionDeadlines } from "./session";
import type { AuthStore, LoginResult, PasswordHasher } from "./types";

let dummyHash: string | null = null;

async function dummyPasswordHash(hasher: PasswordHasher): Promise<string> {
  dummyHash ??= await hasher.hash("auth-module-dummy-password");
  return dummyHash;
}

/**
 * Password login. Unknown emails, wrong passwords, disabled accounts, and
 * unverified emails all return the same `invalid` result.
 */
export async function loginWithPassword(input: {
  store: AuthStore;
  hasher: PasswordHasher;
  email: string;
  password: string;
  now: Date;
  ip: string | null;
  userAgent: string | null;
}): Promise<LoginResult> {
  const email = normalizeEmail(input.email);
  if (!email || input.password.length === 0) {
    return { ok: false, error: "invalid" };
  }

  const since = new Date(input.now.getTime() - LOGIN_WINDOW_MS);
  const ipKey = `ip:${input.ip ?? "unknown"}`;
  const emailKey = `email:${email}`;
  const [ipCount, emailCount] = await Promise.all([
    input.store.countAttempts(ipKey, since),
    input.store.countAttempts(emailKey, since),
  ]);

  if (isRateLimited(ipCount) || isRateLimited(emailCount)) {
    await input.store.audit({
      identityId: null,
      action: "login_rate_limited",
      ip: input.ip,
      userAgent: input.userAgent,
    });
    return { ok: false, error: "rate_limited" };
  }

  await input.store.recordAttempt(ipKey, input.now);
  await input.store.recordAttempt(emailKey, input.now);

  const identity = await input.store.findIdentityByEmail(email);
  const encoded = identity?.passwordHash ?? (await dummyPasswordHash(input.hasher));
  let matches = false;
  try {
    matches = await input.hasher.verify(encoded, input.password);
  } catch {
    matches = false;
  }

  const rejected =
    !identity || !matches || identity.disabledAt !== null || identity.emailVerified === null;

  if (rejected || !identity) {
    const action = !identity
      ? "login_unknown"
      : !matches
        ? "login_failed"
        : identity.disabledAt
          ? "login_disabled"
          : "login_unverified";
    await input.store.audit({
      identityId: identity?.id ?? null,
      action,
      ip: input.ip,
      userAgent: input.userAgent,
    });
    return { ok: false, error: "invalid" };
  }

  const { secret, secretHash } = newSessionSecret();
  const { expiresAt, idleAt } = sessionDeadlines(input.now);
  await input.store.createSession({
    identityId: identity.id,
    secretHash,
    expiresAt,
    idleAt,
    userAgent: input.userAgent,
  });
  await input.store.audit({
    identityId: identity.id,
    action: "login_succeeded",
    ip: input.ip,
    userAgent: input.userAgent,
  });

  return { ok: true, secret, identityId: identity.id };
}
