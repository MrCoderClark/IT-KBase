import { createHash, randomBytes } from "node:crypto";

export const RESET_TOKEN_MS = 60 * 60 * 1000;
export const VERIFY_TOKEN_MS = 24 * 60 * 60 * 1000;

export function newEmailToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashEmailToken(token) };
}

export function hashEmailToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
