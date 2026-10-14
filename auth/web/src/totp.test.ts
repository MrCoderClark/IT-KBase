import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decryptTotpSecret, encryptTotpSecret } from "./mfa-secret";
import { hashRecoveryCode, normalizeRecoveryCode } from "./recovery-codes";
import { qrSvg } from "./qr";
import { base32Encode, hotp, matchTotpStep, newTotpSecret, otpauthUri } from "./totp";

describe("totp", () => {
  it("matches the RFC 6238 SHA-1 vector at 59 seconds", () => {
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    const step = matchTotpStep(secret, "287082", new Date(59_000), null);
    assert.equal(step, 1);
    assert.equal(hotp(Buffer.from("12345678901234567890"), 1), "287082");
  });

  it("rejects a code for a step that was already accepted", () => {
    const secret = newTotpSecret();
    const now = new Date("2026-10-14T16:00:00Z");
    const step = Math.floor(now.getTime() / 1000 / 30);
    const code = hotp(Buffer.from(base32DecodeForTest(secret)), step);
    assert.equal(matchTotpStep(secret, code, now, step), null);
  });
});

describe("qr", () => {
  it("draws a scannable code for a normal authenticator link", () => {
    const uri = otpauthUri({
      issuer: "TechBase",
      account: "joe.clark@techbase.local",
      secret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
    });
    const svg = qrSvg(uri);
    assert.match(svg, /^<svg /);
    assert.match(svg, /rect x="16" y="16" width="4" height="4" fill="#000"/);
    assert.equal(uri.includes("algorithm="), false);
  });
});

describe("mfa secret", () => {
  it("round-trips a secret and ignores spacing in a recovery code", () => {
    const cipher = encryptTotpSecret("ABCDEFGH", "test-key");
    assert.equal(decryptTotpSecret(cipher, "test-key"), "ABCDEFGH");
    assert.equal(normalizeRecoveryCode("Abcd-ef01-2345-6789"), "abcdef0123456789");
    assert.equal(hashRecoveryCode("abcd-ef01-2345-6789"), hashRecoveryCode("ABCDEF0123456789"));
  });
});

function base32DecodeForTest(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of input) {
    value = (value << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
