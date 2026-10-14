import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** Stretch whatever the host put in the environment into a 32-byte AES key. */
export function encryptTotpSecret(plain: string, keyMaterial: string): string {
  const key = stretch(keyMaterial);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, body]).toString("base64url");
}

export function decryptTotpSecret(payload: string, keyMaterial: string): string {
  const key = stretch(keyMaterial);
  const raw = Buffer.from(payload, "base64url");
  if (raw.length < 12 + 16 + 1) throw new Error("Totp secret payload is too short.");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const body = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}

function stretch(keyMaterial: string): Buffer {
  if (!keyMaterial.trim()) throw new Error("MFA key is not configured.");
  return createHash("sha256").update(keyMaterial, "utf8").digest();
}
