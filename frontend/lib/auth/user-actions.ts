"use server";

import { redirect } from "next/navigation";
import { passwordProblem } from "../../../auth/web/src";
import { prisma } from "@/lib/db";
import { can, ROLES, type Role } from "./policy";
import { passwordHasher } from "./password";
import { authStore } from "./store";
import { currentRequestMeta, getSession, requestTime } from "./session";
import { accountEmail, accountName, deleteAccountBlock, disableSignInBlock, roleChangeBlock } from "./user-directory";

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

async function requireAdmin() {
  const session = await getSession();
  if (!session || !can(session.role, "admin.manage")) redirect("/");
  return session;
}

async function enabledAdminIds(): Promise<string[]> {
  const [admins, disabled] = await Promise.all([
    prisma.user.findMany({ where: { role: "admin" }, select: { id: true, identityId: true } }),
    prisma.identity.findMany({ where: { disabledAt: { not: null } }, select: { id: true } }),
  ]);
  const disabledIds = new Set(disabled.map((row) => row.id));
  return admins.filter((admin) => !admin.identityId || !disabledIds.has(admin.identityId)).map((admin) => admin.id);
}

export async function setUserRole(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const nextRole = String(formData.get("role") ?? "");
  if (!isRole(nextRole)) redirect("/admin/users?e=role");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, identityId: true },
  });
  if (!user) redirect("/admin/users?e=missing");
  if (user.role === nextRole) redirect("/admin/users");

  const block = roleChangeBlock({
    actorId: session.userId,
    targetId: user.id,
    targetRole: user.role,
    nextRole,
    enabledAdminIds: await enabledAdminIds(),
  });
  if (block) redirect(`/admin/users?e=${block}`);

  const now = await requestTime();
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { role: nextRole } });
    if (!user.identityId) return;
    await tx.identity.update({
      where: { id: user.identityId },
      data: { sessionGen: { increment: 1 } },
    });
    await tx.identitySession.updateMany({
      where: { identityId: user.identityId, revokedAt: null },
      data: { revokedAt: now },
    });
  });

  const meta = await currentRequestMeta();
  await authStore.audit({
    identityId: user.identityId,
    action: "role_changed",
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  redirect("/admin/users?notice=role");
}

export async function setSignInEnabled(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const enable = formData.get("enabled") === "1";

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, identityId: true },
  });
  if (!user?.identityId) redirect("/admin/users?e=missing");

  const identity = await prisma.identity.findUnique({
    where: { id: user.identityId },
    select: { disabledAt: true },
  });
  if (!identity) redirect("/admin/users?e=missing");
  if (enable === (identity.disabledAt === null)) redirect("/admin/users");

  if (!enable) {
    const block = disableSignInBlock({
      actorId: session.userId,
      targetId: user.id,
      targetRole: user.role,
      enabledAdminIds: await enabledAdminIds(),
    });
    if (block) redirect(`/admin/users?e=${block}`);
  }

  const now = await requestTime();
  if (enable) {
    await prisma.identity.update({
      where: { id: user.identityId },
      data: { disabledAt: null },
    });
  } else {
    await prisma.$transaction([
      prisma.identity.update({
        where: { id: user.identityId },
        data: { disabledAt: now, sessionGen: { increment: 1 } },
      }),
      prisma.identitySession.updateMany({
        where: { identityId: user.identityId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
  }

  const meta = await currentRequestMeta();
  await authStore.audit({
    identityId: user.identityId,
    action: enable ? "sign_in_enabled" : "sign_in_disabled",
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  redirect(enable ? "/admin/users?notice=on" : "/admin/users?notice=off");
}

async function emailTaken(email: string, exceptUserId?: string): Promise<boolean> {
  const [user, identity] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.identity.findUnique({ where: { email }, select: { id: true } }),
  ]);
  if (user && user.id !== exceptUserId) return true;
  if (!identity) return false;
  if (!exceptUserId) return true;
  const owner = await prisma.user.findUnique({
    where: { id: exceptUserId },
    select: { identityId: true },
  });
  return owner?.identityId !== identity.id;
}

export async function createUser(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const name = accountName(String(formData.get("name") ?? ""));
  if (!name) redirect("/admin/users?e=name");
  const email = accountEmail(String(formData.get("email") ?? ""));
  if (!email) redirect("/admin/users?e=email");
  const role = String(formData.get("role") ?? "");
  if (!isRole(role)) redirect("/admin/users?e=role");
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirmPassword") ?? "")) redirect("/admin/users?e=match");
  const { zxcvbnScore } = await import("./zxcvbn-score");
  const problem = await passwordProblem(password, { score: zxcvbnScore });
  if (problem) {
    redirect(`/admin/users?e=password&m=${encodeURIComponent(problem)}`);
  }
  if (await emailTaken(email)) redirect("/admin/users?e=taken");

  const now = await requestTime();
  const passwordHash = await passwordHasher.hash(password);
  const created = await prisma.$transaction(async (tx) => {
    const identity = await tx.identity.create({
      data: { email, passwordHash, emailVerified: now },
      select: { id: true },
    });
    return tx.user.create({
      data: { name, email, role, identityId: identity.id },
      select: { identityId: true },
    });
  });

  const meta = await currentRequestMeta();
  await authStore.audit({
    identityId: created.identityId,
    action: "user_created",
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  redirect("/admin/users?notice=created");
}

export async function updateUserProfile(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const name = accountName(String(formData.get("name") ?? ""));
  if (!name) redirect("/admin/users?e=name");
  const email = accountEmail(String(formData.get("email") ?? ""));
  if (!email) redirect("/admin/users?e=email");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, identityId: true },
  });
  if (!user) redirect("/admin/users?e=missing");
  if (user.name === name && user.email === email) redirect("/admin/users");
  if (email !== user.email && (await emailTaken(email, user.id))) redirect("/admin/users?e=taken");

  const emailChanged = email !== user.email;
  const now = await requestTime();
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { name, email } });
    if (!user.identityId || !emailChanged) return;
    await tx.identity.update({
      where: { id: user.identityId },
      data: { email, sessionGen: { increment: 1 } },
    });
    await tx.identitySession.updateMany({
      where: { identityId: user.identityId, revokedAt: null },
      data: { revokedAt: now },
    });
  });

  const meta = await currentRequestMeta();
  await authStore.audit({
    identityId: user.identityId,
    action: emailChanged ? "email_changed" : "name_changed",
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  if (emailChanged && user.id === session.userId) redirect("/login");
  redirect(emailChanged ? "/admin/users?notice=email" : "/admin/users?notice=name");
}

export async function deleteUser(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, identityId: true },
  });
  if (!user) redirect("/admin/users?e=missing");
  if (accountEmail(String(formData.get("confirmEmail") ?? "")) !== user.email) {
    redirect("/admin/users?e=confirm");
  }

  const block = deleteAccountBlock({
    actorId: session.userId,
    targetId: user.id,
    targetRole: user.role,
    enabledAdminIds: await enabledAdminIds(),
  });
  if (block) redirect(`/admin/users?e=${block}`);

  const now = await requestTime();
  const meta = await currentRequestMeta();
  await authStore.audit({
    identityId: user.identityId,
    action: "user_deleted",
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  await prisma.$transaction(async (tx) => {
    await tx.article.updateMany({ where: { authorId: user.id }, data: { authorId: session.userId } });
    await tx.articleVersion.updateMany({ where: { authorId: user.id }, data: { authorId: session.userId } });
    await tx.feedback.updateMany({ where: { userId: user.id }, data: { userId: null } });
    await tx.ingestionJob.updateMany({ where: { createdById: user.id }, data: { createdById: session.userId } });
    if (user.identityId) {
      await tx.identity.update({
        where: { id: user.identityId },
        data: { sessionGen: { increment: 1 } },
      });
      await tx.identitySession.updateMany({
        where: { identityId: user.identityId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.identity.delete({ where: { id: user.identityId } });
    }
    await tx.user.delete({ where: { id: user.id } });
  });
  redirect("/admin/users?notice=deleted");
}
