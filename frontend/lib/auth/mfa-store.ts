import { prisma } from "@/lib/db";

export function findTotp(identityId: string) {
  return prisma.totpCredential.findUnique({ where: { identityId } });
}

export async function savePendingTotp(identityId: string, secretCipher: string): Promise<void> {
  await prisma.totpCredential.upsert({
    where: { identityId },
    create: { identityId, secretCipher },
    update: { secretCipher, confirmedAt: null, lastStep: null },
  });
}

export async function confirmTotp(input: {
  identityId: string;
  keepSessionId: string;
  step: number;
  recoveryHashes: string[];
  at: Date;
}): Promise<void> {
  await prisma.$transaction([
    prisma.totpCredential.update({
      where: { identityId: input.identityId },
      data: { confirmedAt: input.at, lastStep: input.step },
    }),
    prisma.recoveryCode.deleteMany({ where: { identityId: input.identityId } }),
    prisma.recoveryCode.createMany({
      data: input.recoveryHashes.map((codeHash) => ({
        identityId: input.identityId,
        codeHash,
      })),
    }),
    prisma.identitySession.updateMany({
      where: { identityId: input.identityId, revokedAt: null, id: { not: input.keepSessionId } },
      data: { revokedAt: input.at },
    }),
    prisma.identity.update({
      where: { id: input.identityId },
      data: { sessionGen: { increment: 1 } },
    }),
  ]);
}

/** True when this step is newer than the last accepted one. */
export async function acceptTotpStep(identityId: string, step: number): Promise<boolean> {
  const result = await prisma.totpCredential.updateMany({
    where: {
      identityId,
      confirmedAt: { not: null },
      OR: [{ lastStep: null }, { lastStep: { lt: step } }],
    },
    data: { lastStep: step },
  });
  return result.count === 1;
}

export async function consumeRecoveryCode(
  identityId: string,
  codeHash: string,
  at: Date,
): Promise<boolean> {
  const result = await prisma.recoveryCode.updateMany({
    where: { identityId, codeHash, usedAt: null },
    data: { usedAt: at },
  });
  return result.count === 1;
}

export async function replaceRecoveryCodes(input: {
  identityId: string;
  keepSessionId: string;
  recoveryHashes: string[];
  at: Date;
}): Promise<void> {
  await prisma.$transaction([
    prisma.recoveryCode.deleteMany({ where: { identityId: input.identityId } }),
    prisma.recoveryCode.createMany({
      data: input.recoveryHashes.map((codeHash) => ({
        identityId: input.identityId,
        codeHash,
      })),
    }),
    prisma.identitySession.updateMany({
      where: { identityId: input.identityId, revokedAt: null, id: { not: input.keepSessionId } },
      data: { revokedAt: input.at },
    }),
    prisma.identity.update({
      where: { id: input.identityId },
      data: { sessionGen: { increment: 1 } },
    }),
  ]);
}

export async function clearMfa(identityId: string, keepSessionId: string, at: Date): Promise<void> {
  await prisma.$transaction([
    prisma.totpCredential.deleteMany({ where: { identityId } }),
    prisma.recoveryCode.deleteMany({ where: { identityId } }),
    prisma.mfaChallenge.deleteMany({ where: { identityId } }),
    prisma.identitySession.updateMany({
      where: { identityId, revokedAt: null, id: { not: keepSessionId } },
      data: { revokedAt: at },
    }),
    prisma.identity.update({
      where: { id: identityId },
      data: { sessionGen: { increment: 1 } },
    }),
  ]);
}

export async function saveMfaChallenge(input: {
  identityId: string;
  secretHash: string;
  expiresAt: Date;
}): Promise<void> {
  await prisma.$transaction([
    prisma.mfaChallenge.deleteMany({ where: { identityId: input.identityId } }),
    prisma.mfaChallenge.create({ data: input }),
  ]);
}

export function findMfaChallenge(secretHash: string) {
  return prisma.mfaChallenge.findUnique({ where: { secretHash } });
}

export async function deleteMfaChallenge(id: string): Promise<void> {
  await prisma.mfaChallenge.delete({ where: { id } }).catch(() => undefined);
}
