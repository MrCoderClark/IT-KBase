import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const RECOVERY_CODE_COUNT = 10;

export function newRecoveryCodes(): { plain: string[]; hashes: string[] } {
  const plain = Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const raw = randomBytes(8).toString("hex");
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12)}`;
  });
  return { plain, hashes: plain.map(hashRecoveryCode) };
}

export function hashRecoveryCode(plain: string): string {
  return createHash("sha256").update(normalizeRecoveryCode(plain)).digest("hex");
}

export function recoveryCodeMatches(plain: string, hash: string): boolean {
  const given = Buffer.from(hashRecoveryCode(plain));
  const actual = Buffer.from(hash);
  return given.length === actual.length && timingSafeEqual(given, actual);
}

export function normalizeRecoveryCode(plain: string): string {
  return plain.toLowerCase().replace(/[^a-f0-9]/g, "");
}
