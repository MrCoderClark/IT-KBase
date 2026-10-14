import type { AuthStore } from "../../../auth/web/src/types";
import { prisma } from "@/lib/db";

export const authStore: AuthStore = {
  countAttempts(key, since) {
    return prisma.loginAttempt.count({
      where: { key, attempted: { gte: since } },
    });
  },

  async recordAttempt(key, at) {
    await prisma.loginAttempt.create({
      data: { key, attempted: at },
    });
  },

  findIdentityByEmail(email) {
    return prisma.identity.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        emailVerified: true,
        disabledAt: true,
      },
    });
  },

  async createSession(input) {
    await prisma.identitySession.create({ data: input });
  },

  findSessionBySecretHash(secretHash) {
    return prisma.identitySession.findUnique({
      where: { secretHash },
      select: {
        id: true,
        identityId: true,
        expiresAt: true,
        idleAt: true,
        revokedAt: true,
      },
    });
  },

  async touchSession(id, idleAt) {
    await prisma.identitySession.update({
      where: { id },
      data: { idleAt },
    });
  },

  async revokeSession(id, at) {
    await prisma.identitySession.update({
      where: { id },
      data: { revokedAt: at },
    });
  },

  async saveEmailToken(input) {
    await prisma.$transaction([
      prisma.emailToken.deleteMany({
        where: { identityId: input.identityId, purpose: input.purpose, usedAt: null },
      }),
      prisma.emailToken.create({ data: input }),
    ]);
  },

  findEmailToken(tokenHash) {
    return prisma.emailToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        identityId: true,
        purpose: true,
        expiresAt: true,
        usedAt: true,
      },
    });
  },

  async consumeEmailToken(id, at) {
    const result = await prisma.emailToken.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: at },
    });
    return result.count === 1;
  },

  async setPasswordAndRevokeSessions(identityId, passwordHash, at) {
    await prisma.$transaction([
      prisma.identity.update({
        where: { id: identityId },
        data: { passwordHash, sessionGen: { increment: 1 } },
      }),
      prisma.identitySession.updateMany({
        where: { identityId, revokedAt: null },
        data: { revokedAt: at },
      }),
    ]);
  },

  async markEmailVerified(identityId, at) {
    await prisma.identity.update({
      where: { id: identityId },
      data: { emailVerified: at },
    });
  },

  async audit(event) {
    await prisma.authAuditEvent.create({ data: event });
  },
};
