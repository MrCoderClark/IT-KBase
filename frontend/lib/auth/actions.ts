"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  completeEmailVerification,
  completePasswordReset,
  hashSessionSecret,
  loginWithPassword,
  newSessionSecret,
  requestPasswordReset,
  safeNextPath,
} from "../../../auth/web/src";
import { sendAuthEmail } from "./mail";
import { passwordHasher } from "./password";
import { saveMfaChallenge } from "./mfa-store";
import {
  appOrigin,
  clearSessionCookie,
  currentRequestMeta,
  requestTime,
  setMfaCookie,
  setSessionCookie,
} from "./session";
import { authStore } from "./store";
import { prisma } from "@/lib/db";

export async function login(formData: FormData): Promise<void> {
  const nextPath = safeNextPath(String(formData.get("next") ?? ""));
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const meta = await currentRequestMeta();

  const result = await loginWithPassword({
    store: authStore,
    hasher: passwordHasher,
    email,
    password,
    now: await requestTime(),
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  if (!result.ok) {
    const code = result.error === "rate_limited" ? "2" : "1";
    redirect(`/login?e=${code}&next=${encodeURIComponent(nextPath)}`);
  }

  const user = await prisma.user.findUnique({
    where: { identityId: result.identityId },
    select: { id: true },
  });
  if (!user) {
    if (!result.mfaRequired) {
      const created = await authStore.findSessionBySecretHash(hashSessionSecret(result.secret));
      if (created) await authStore.revokeSession(created.id, await requestTime());
    }
    redirect(`/login?e=1&next=${encodeURIComponent(nextPath)}`);
  }

  if (result.mfaRequired) {
    const now = await requestTime();
    const challenge = newSessionSecret();
    await saveMfaChallenge({
      identityId: result.identityId,
      secretHash: challenge.secretHash,
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
    });
    await setMfaCookie(challenge.secret);
    redirect(`/login/mfa?next=${encodeURIComponent(nextPath)}`);
  }

  await setSessionCookie(result.secret);
  redirect(nextPath);
}

export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}

export async function requestReset(formData: FormData): Promise<void> {
  const headerList = await headers();
  const meta = await currentRequestMeta();
  const result = await requestPasswordReset({
    store: authStore,
    email: String(formData.get("email") ?? ""),
    now: await requestTime(),
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  if (result.status === "invalid_email") redirect("/forgot-password?e=1");
  if (result.status === "rate_limited") redirect("/forgot-password?e=2");

  if (result.mail) {
    const origin = appOrigin(headerList);
    const path = result.mail.kind === "reset_password" ? "/reset-password" : "/verify-email";
    const url = `${origin}${path}?token=${encodeURIComponent(result.mail.token)}`;
    const subject =
      result.mail.kind === "reset_password" ? "Reset your TechBase password" : "Verify your TechBase email";
    const lifetime = result.mail.kind === "reset_password" ? "one hour" : "24 hours";
    await sendAuthEmail({
      to: result.mail.to,
      subject,
      text: `${subject}:\n${url}\n\nThis link expires in ${lifetime} and works once.`,
    });
  }

  redirect("/forgot-password?sent=1");
}

export async function resetPassword(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const back = `/reset-password?token=${encodeURIComponent(token)}`;
  if (password !== confirm) redirect(`${back}&e=match`);

  const meta = await currentRequestMeta();
  const { zxcvbnScore } = await import("./zxcvbn-score");
  const result = await completePasswordReset({
    store: authStore,
    hasher: passwordHasher,
    token,
    password,
    now: await requestTime(),
    ip: meta.ip,
    userAgent: meta.userAgent,
    passwordChecks: { score: zxcvbnScore },
  });
  if (!result.ok) {
    if (result.error === "weak" && result.message) {
      redirect(`${back}&e=weak&m=${encodeURIComponent(result.message)}`);
    }
    redirect(`${back}&e=${result.error}`);
  }
  redirect("/login?notice=reset");
}

export async function verifyEmail(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const meta = await currentRequestMeta();
  const result = await completeEmailVerification({
    store: authStore,
    token,
    now: await requestTime(),
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  if (!result.ok) redirect("/verify-email?e=invalid");
  redirect("/login?notice=verified");
}
