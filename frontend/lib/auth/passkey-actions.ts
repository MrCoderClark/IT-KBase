"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import {
  hashSessionSecret,
  isRateLimited,
  LOGIN_WINDOW_MS,
  newSessionSecret,
  safeNextPath,
  sessionDeadlines,
} from "../../../auth/web/src/session";
import { passkeyName, signatureCounterRegressed } from "../../../auth/web/src/passkey";
import { prisma } from "@/lib/db";
import { authStore } from "./store";
import {
  deleteExpiredPasskeyChallenges,
  deleteOwnPasskey,
  deletePasskeyChallenge,
  findPasskeyByCredentialId,
  findPasskeyChallenge,
  listPasskeys,
  savePasskey,
  savePasskeyChallenge,
  updatePasskeyCounter,
} from "./passkey-store";
import {
  appOrigin,
  clearPasskeyCookie,
  currentRequestMeta,
  getSession,
  readPasskeyCookie,
  requestTime,
  setPasskeyCookie,
  setSessionCookie,
} from "./session";
import { PASSKEY_ALGORITHMS, WEBAUTHN_RP_NAME, webauthnRelyingParty } from "./webauthn-config";

const LIMITED = "Too many attempts. Wait a few minutes and try again.";
const SIGN_IN_FAILED = "That passkey could not be used.";
const SAVE_FAILED = "That passkey could not be saved.";

export async function beginPasskeyRegistration(): Promise<
  | { ok: true; options: Awaited<ReturnType<typeof generateRegistrationOptions>> }
  | { ok: false; error: string }
> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sign in first." };

  const now = await requestTime();
  const { rpID } = webauthnRelyingParty(appOrigin(await headers()));
  const existing = await listPasskeys(session.identityId);
  const options = await generateRegistrationOptions({
    rpName: WEBAUTHN_RP_NAME,
    rpID,
    userName: session.email,
    userDisplayName: session.name || session.email,
    userID: new TextEncoder().encode(session.identityId),
    attestationType: "none",
    supportedAlgorithmIDs: PASSKEY_ALGORITHMS,
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
    excludeCredentials: existing.map((row) => ({
      id: row.credentialId,
      transports: splitTransports(row.transports),
    })),
  });
  if (options.hints?.length === 0) delete options.hints;
  delete options.extensions;

  const { secret, secretHash } = newSessionSecret();
  await deleteExpiredPasskeyChallenges(now);
  await savePasskeyChallenge({
    identityId: session.identityId,
    secretHash,
    purpose: "register",
    challenge: options.challenge,
    expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
  });
  await setPasskeyCookie(secret);
  return { ok: true, options };
}

export async function finishPasskeyRegistration(
  response: RegistrationResponseJSON,
  name: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sign in first." };

  const now = await requestTime();
  const challenge = await takeChallenge("register", now);
  if (!challenge || challenge.identityId !== session.identityId) {
    return { ok: false, error: "That setup expired. Try again." };
  }

  const meta = await currentRequestMeta();
  const limited = await noteAttempt(`passkey-reg:${session.identityId}`, meta.ip, now);
  if (limited) return { ok: false, error: LIMITED };
  if (!hasCredentialId(response)) return { ok: false, error: SAVE_FAILED };

  try {
    const { rpID, origin } = webauthnRelyingParty(appOrigin(await headers()));
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      supportedAlgorithmIDs: PASSKEY_ALGORITHMS,
    });
    if (!verification.verified) return { ok: false, error: SAVE_FAILED };

    const credential = verification.registrationInfo.credential;
    await savePasskey({
      identityId: session.identityId,
      credentialId: credential.id,
      publicKey: new Uint8Array(credential.publicKey),
      counter: credential.counter,
      transports: (credential.transports ?? response.response.transports ?? []).join(","),
      name: passkeyName(name),
    });
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }

  await authStore.audit({
    identityId: session.identityId,
    action: "passkey_registered",
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return { ok: true };
}

export async function removePasskey(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");

  const id = String(formData.get("id") ?? "");
  const removed = await deleteOwnPasskey(session.identityId, id);
  if (removed) {
    const meta = await currentRequestMeta();
    await authStore.audit({
      identityId: session.identityId,
      action: "passkey_removed",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }
  redirect("/account/security");
}

export async function beginPasskeyLogin(): Promise<
  | { ok: true; options: Awaited<ReturnType<typeof generateAuthenticationOptions>> }
  | { ok: false; error: string }
> {
  const now = await requestTime();
  const { rpID } = webauthnRelyingParty(appOrigin(await headers()));
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
  });

  const { secret, secretHash } = newSessionSecret();
  await deleteExpiredPasskeyChallenges(now);
  await savePasskeyChallenge({
    identityId: null,
    secretHash,
    purpose: "authenticate",
    challenge: options.challenge,
    expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
  });
  await setPasskeyCookie(secret);
  return { ok: true, options };
}

export async function finishPasskeyLogin(
  response: AuthenticationResponseJSON,
  nextPath: string,
): Promise<{ ok: true; nextPath: string } | { ok: false; error: string }> {
  const now = await requestTime();
  const challenge = await takeChallenge("authenticate", now);
  if (!challenge) return { ok: false, error: "That sign-in expired. Try again." };

  const meta = await currentRequestMeta();
  const limited = await noteAttempt("passkey-login", meta.ip, now);
  if (limited) return { ok: false, error: LIMITED };
  if (!hasCredentialId(response)) {
    await auditLogin(null, meta, "login_passkey_failed");
    return { ok: false, error: SIGN_IN_FAILED };
  }

  const passkey = await findPasskeyByCredentialId(response.id);
  if (!passkey) {
    await auditLogin(null, meta, "login_passkey_failed");
    return { ok: false, error: SIGN_IN_FAILED };
  }

  const identity = await prisma.identity.findUnique({
    where: { id: passkey.identityId },
    select: { disabledAt: true },
  });
  const user = await prisma.user.findUnique({
    where: { identityId: passkey.identityId },
    select: { id: true },
  });
  if (!identity || identity.disabledAt || !user) {
    await auditLogin(passkey.identityId, meta, "login_passkey_failed");
    return { ok: false, error: SIGN_IN_FAILED };
  }

  try {
    const { rpID, origin } = webauthnRelyingParty(appOrigin(await headers()));
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: passkey.counter,
        transports: splitTransports(passkey.transports),
      },
    });
    const nextCounter = verification.authenticationInfo.newCounter;
    if (!verification.verified || signatureCounterRegressed(passkey.counter, nextCounter)) {
      await auditLogin(passkey.identityId, meta, "login_passkey_failed");
      return { ok: false, error: SIGN_IN_FAILED };
    }
    await updatePasskeyCounter(passkey.id, nextCounter);
  } catch {
    await auditLogin(passkey.identityId, meta, "login_passkey_failed");
    return { ok: false, error: SIGN_IN_FAILED };
  }

  const { secret, secretHash } = newSessionSecret();
  const deadlines = sessionDeadlines(now);
  await authStore.createSession({
    identityId: passkey.identityId,
    secretHash,
    expiresAt: deadlines.expiresAt,
    idleAt: deadlines.idleAt,
    userAgent: meta.userAgent,
  });
  await auditLogin(passkey.identityId, meta, "login_passkey_succeeded");
  await setSessionCookie(secret);
  return { ok: true, nextPath: safeNextPath(nextPath) };
}

async function takeChallenge(
  purpose: "register" | "authenticate",
  now: Date,
): Promise<{ identityId: string | null; challenge: string } | null> {
  const secret = await readPasskeyCookie();
  if (!secret) return null;
  const row = await findPasskeyChallenge(hashSessionSecret(secret));
  await clearPasskeyCookie();
  if (!row) return null;
  await deletePasskeyChallenge(row.id);
  if (row.purpose !== purpose || row.expiresAt.getTime() <= now.getTime()) return null;
  return { identityId: row.identityId, challenge: row.challenge };
}

async function noteAttempt(scope: string, ip: string | null, now: Date): Promise<boolean> {
  const since = new Date(now.getTime() - LOGIN_WINDOW_MS);
  const key = `${scope}:${ip ?? "unknown"}`;
  const count = await authStore.countAttempts(key, since);
  if (isRateLimited(count)) return true;
  await authStore.recordAttempt(key, now);
  return false;
}

async function auditLogin(
  identityId: string | null,
  meta: { ip: string | null; userAgent: string | null },
  action: "login_passkey_succeeded" | "login_passkey_failed",
): Promise<void> {
  await authStore.audit({
    identityId,
    action,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
}

function hasCredentialId(response: { id?: string }): boolean {
  return typeof response?.id === "string" && response.id.length > 0 && response.id.length <= 1024;
}

function splitTransports(value: string): string[] | undefined {
  const list = value.split(",").map((item) => item.trim()).filter(Boolean);
  return list.length > 0 ? list : undefined;
}
