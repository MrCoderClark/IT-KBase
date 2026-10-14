"use server";

import { redirect } from "next/navigation";
import {
  hashSessionSecret,
  isRateLimited,
  LOGIN_WINDOW_MS,
  newSessionSecret,
  safeNextPath,
  sessionDeadlines,
} from "../../../auth/web/src/session";
import { decryptTotpSecret, encryptTotpSecret } from "../../../auth/web/src/mfa-secret";
import { hashRecoveryCode, newRecoveryCodes } from "../../../auth/web/src/recovery-codes";
import { matchTotpStep, newTotpSecret } from "../../../auth/web/src/totp";
import { mfaKey } from "./mfa-key";
import { authStore } from "./store";
import {
  acceptTotpStep,
  clearMfa,
  confirmTotp,
  consumeRecoveryCode,
  deleteMfaChallenge,
  findMfaChallenge,
  findTotp,
  replaceRecoveryCodes,
  saveMfaChallenge,
  savePendingTotp,
} from "./mfa-store";
import {
  clearMfaCookie,
  clearRecoveryCookie,
  currentRequestMeta,
  getSession,
  readMfaCookie,
  requestTime,
  setRecoveryCookie,
  setSessionCookie,
} from "./session";
export async function beginTotp(): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const key = mfaKey();
  if (!key) redirect("/account/security?e=key");
  const existing = await findTotp(session.identityId);
  if (existing?.confirmedAt) redirect("/account/security");
  await savePendingTotp(session.identityId, encryptTotpSecret(newTotpSecret(), key));
  redirect("/account/security");
}

export async function confirmTotpEnrollment(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const key = mfaKey();
  if (!key) redirect("/account/security?e=key");
  const row = await findTotp(session.identityId);
  if (!row || row.confirmedAt) redirect("/account/security");
  const now = await requestTime();
  const secret = decryptTotpSecret(row.secretCipher, key);
  const step = matchTotpStep(secret, String(formData.get("code") ?? ""), now, null);
  if (step === null) redirect("/account/security?e=code");
  const codes = newRecoveryCodes();
  await confirmTotp({
    identityId: session.identityId,
    keepSessionId: session.sessionId,
    step,
    recoveryHashes: codes.hashes,
    at: now,
  });
  await authStore.audit({
    identityId: session.identityId,
    action: "mfa_enabled",
    ip: (await currentRequestMeta()).ip,
    userAgent: (await currentRequestMeta()).userAgent,
  });
  await setRecoveryCookie(encryptTotpSecret(JSON.stringify(codes.plain), key));
  redirect("/account/security?codes=1");
}

export async function disableTotp(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const ok = await codeIsValid(session.identityId, String(formData.get("code") ?? ""));
  if (!ok) redirect("/account/security?e=code");
  const now = await requestTime();
  await clearMfa(session.identityId, session.sessionId, now);
  const meta = await currentRequestMeta();
  await authStore.audit({
    identityId: session.identityId,
    action: "mfa_disabled",
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  redirect("/account/security?notice=off");
}

export async function regenerateRecoveryCodes(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const key = mfaKey();
  if (!key) redirect("/account/security?e=key");
  const ok = await codeIsValid(session.identityId, String(formData.get("code") ?? ""));
  if (!ok) redirect("/account/security?e=code");
  const codes = newRecoveryCodes();
  const now = await requestTime();
  await replaceRecoveryCodes({
    identityId: session.identityId,
    keepSessionId: session.sessionId,
    recoveryHashes: codes.hashes,
    at: now,
  });
  const meta = await currentRequestMeta();
  await authStore.audit({
    identityId: session.identityId,
    action: "mfa_recovery_regenerated",
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  await setRecoveryCookie(encryptTotpSecret(JSON.stringify(codes.plain), key));
  redirect("/account/security?codes=1");
}

export async function dismissRecoveryCodes(): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  await clearRecoveryCookie();
  redirect("/account/security");
}

export async function submitMfa(formData: FormData): Promise<void> {
  const nextPath = safeNextPath(String(formData.get("next") ?? ""));
  const back = `/login/mfa?next=${encodeURIComponent(nextPath)}`;
  const presented = await readMfaCookie();
  if (!presented) redirect(`/login?e=1&next=${encodeURIComponent(nextPath)}`);

  const now = await requestTime();
  const challenge = await findMfaChallenge(hashSessionSecret(presented));
  if (!challenge || challenge.expiresAt.getTime() <= now.getTime()) {
    await clearMfaCookie();
    redirect(`/login?e=1&next=${encodeURIComponent(nextPath)}`);
  }

  const meta = await currentRequestMeta();
  const since = new Date(now.getTime() - LOGIN_WINDOW_MS);
  const ipKey = `mfa-ip:${meta.ip ?? "unknown"}`;
  const idKey = `mfa-id:${challenge.identityId}`;
  const [ipCount, idCount] = await Promise.all([
    authStore.countAttempts(ipKey, since),
    authStore.countAttempts(idKey, since),
  ]);
  if (isRateLimited(ipCount) || isRateLimited(idCount)) {
    redirect(`${back}&e=2`);
  }
  await authStore.recordAttempt(ipKey, now);
  await authStore.recordAttempt(idKey, now);

  const code = String(formData.get("code") ?? "");
  const usedRecovery = await acceptSecondFactor(challenge.identityId, code, now);
  if (!usedRecovery.ok) {
    await authStore.audit({
      identityId: challenge.identityId,
      action: "login_mfa_failed",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    redirect(`${back}&e=1`);
  }

  await deleteMfaChallenge(challenge.id);
  await clearMfaCookie();
  const { secret, secretHash } = newSessionSecret();
  const deadlines = sessionDeadlines(now);
  await authStore.createSession({
    identityId: challenge.identityId,
    secretHash,
    expiresAt: deadlines.expiresAt,
    idleAt: deadlines.idleAt,
    userAgent: meta.userAgent,
  });
  await authStore.audit({
    identityId: challenge.identityId,
    action: usedRecovery.recovery ? "login_mfa_recovery" : "login_mfa_succeeded",
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  await setSessionCookie(secret);
  redirect(nextPath);
}

async function acceptSecondFactor(
  identityId: string,
  code: string,
  now: Date,
): Promise<{ ok: true; recovery: boolean } | { ok: false }> {
  const key = mfaKey();
  const row = await findTotp(identityId);
  if (!key || !row?.confirmedAt) return { ok: false };
  const secret = decryptTotpSecret(row.secretCipher, key);
  const step = matchTotpStep(secret, code, now, row.lastStep);
  if (step !== null) {
    const accepted = await acceptTotpStep(identityId, step);
    return accepted ? { ok: true, recovery: false } : { ok: false };
  }
  const consumed = await consumeRecoveryCode(identityId, hashRecoveryCode(code), now);
  return consumed ? { ok: true, recovery: true } : { ok: false };
}

async function codeIsValid(identityId: string, code: string): Promise<boolean> {
  const now = await requestTime();
  const result = await acceptSecondFactor(identityId, code, now);
  return result.ok;
}
