import type { AppSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

/** Build a session-shaped principal for the ingest worker (no browser cookie). */
export async function appSessionForUserId(userId: string): Promise<AppSession | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      avatarUrl: true,
      identityId: true,
    },
  });
  if (!user?.identityId) return null;
  return {
    sessionId: `worker:${user.id}`,
    identityId: user.identityId,
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
  };
}
