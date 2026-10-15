"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { can, ROLES, type Role } from "./policy";
import { authStore } from "./store";
import { currentRequestMeta, getSession, requestTime } from "./session";
import { disableSignInBlock, roleChangeBlock } from "./user-directory";

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
