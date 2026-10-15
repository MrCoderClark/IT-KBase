import { prisma } from "@/lib/db";

export type StoredPasskey = {
  id: string;
  credentialId: string;
  publicKey: Uint8Array;
  counter: number;
  transports: string;
  name: string;
  createdAt: Date;
};

export function listPasskeys(identityId: string): Promise<StoredPasskey[]> {
  return prisma.passkey.findMany({
    where: { identityId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      credentialId: true,
      publicKey: true,
      counter: true,
      transports: true,
      name: true,
      createdAt: true,
    },
  });
}

export function findPasskeyByCredentialId(credentialId: string): Promise<
  (StoredPasskey & { identityId: string }) | null
> {
  return prisma.passkey.findUnique({
    where: { credentialId },
    select: {
      id: true,
      identityId: true,
      credentialId: true,
      publicKey: true,
      counter: true,
      transports: true,
      name: true,
      createdAt: true,
    },
  });
}

export async function savePasskey(input: {
  identityId: string;
  credentialId: string;
  publicKey: Uint8Array;
  counter: number;
  transports: string;
  name: string;
}): Promise<void> {
  await prisma.passkey.create({
    data: {
      ...input,
      publicKey: Uint8Array.from(input.publicKey),
    },
  });
}

export async function updatePasskeyCounter(id: string, counter: number): Promise<void> {
  await prisma.passkey.update({ where: { id }, data: { counter } });
}

export async function deleteOwnPasskey(identityId: string, id: string): Promise<boolean> {
  const result = await prisma.passkey.deleteMany({ where: { id, identityId } });
  return result.count === 1;
}

export async function savePasskeyChallenge(input: {
  identityId: string | null;
  secretHash: string;
  purpose: "register" | "authenticate";
  challenge: string;
  expiresAt: Date;
}): Promise<void> {
  await prisma.passkeyChallenge.create({ data: input });
}

export function findPasskeyChallenge(secretHash: string): Promise<{
  id: string;
  identityId: string | null;
  purpose: string;
  challenge: string;
  expiresAt: Date;
} | null> {
  return prisma.passkeyChallenge.findUnique({
    where: { secretHash },
    select: { id: true, identityId: true, purpose: true, challenge: true, expiresAt: true },
  });
}

export async function deletePasskeyChallenge(id: string): Promise<void> {
  await prisma.passkeyChallenge.deleteMany({ where: { id } });
}

export async function deleteExpiredPasskeyChallenges(now: Date): Promise<void> {
  await prisma.passkeyChallenge.deleteMany({ where: { expiresAt: { lt: now } } });
}
