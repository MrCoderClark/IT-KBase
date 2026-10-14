import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** 20 random bytes, the usual authenticator secret size. */
export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function otpauthUri(input: { issuer: string; account: string; secret: string }): string {
  const label = encodeURIComponent(`${input.issuer}:${input.account}`);
  const query = new URLSearchParams({
    secret: input.secret,
    issuer: input.issuer,
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

/**
 * Check a 6-digit code against the current 30-second step and one step either side.
 * Returns the accepted step, or null. The caller must reject a step it has already accepted.
 */
export function matchTotpStep(
  secret: string,
  code: string,
  now: Date,
  lastStep: number | null,
): number | null {
  const digits = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(digits)) return null;
  const current = Math.floor(now.getTime() / 1000 / 30);
  for (const step of [current - 1, current, current + 1]) {
    if (step < 0) continue;
    if (lastStep !== null && step <= lastStep) continue;
    const expected = hotp(base32Decode(secret), step);
    const given = Buffer.from(digits);
    const actual = Buffer.from(expected);
    if (given.length === actual.length && timingSafeEqual(given, actual)) return step;
  }
  return null;
}

/** RFC 6238 / RFC 4226. Exported for the known test vector. */
export function hotp(key: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", key).update(msg).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const bin =
    ((mac[offset]! & 0x7f) << 24) |
    (mac[offset + 1]! << 16) |
    (mac[offset + 2]! << 8) |
    mac[offset + 3]!;
  return String(bin % 1_000_000).padStart(6, "0");
}

export function base32Encode(data: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of input.toUpperCase().replace(/=+$/g, "")) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
