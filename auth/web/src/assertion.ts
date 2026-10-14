import { createHmac, timingSafeEqual } from "node:crypto";

/** Assertions last one minute. FastAPI rejects anything older. */
export const ASSERTION_TTL_SECONDS = 60;
export const ASSERTION_AUDIENCE = "ingestion";

export type AssertionClaims = {
  aud: string;
  exp: number;
  gen: number;
  iat: number;
  kid: string;
  role: string;
  sub: string;
  uid: string;
};

export type AssertionKeys = Record<string, string>;

/** `kid:secret,kid2:secret`. The secret is the HMAC key as a literal string. */
export function parseAssertionKeys(raw: string | undefined): AssertionKeys {
  const keys: AssertionKeys = {};
  if (!raw) return keys;
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const splitAt = trimmed.indexOf(":");
    if (splitAt <= 0) continue;
    const kid = trimmed.slice(0, splitAt).trim();
    const secret = trimmed.slice(splitAt + 1);
    if (kid && secret) keys[kid] = secret;
  }
  return keys;
}

export function mintAssertion(input: {
  keys: AssertionKeys;
  kid: string;
  identityId: string;
  userId: string;
  role: string;
  sessionGen: number;
  now: Date;
  audience?: string;
}): string {
  const secret = input.keys[input.kid];
  if (!secret) throw new Error("Assertion signing key is not configured.");
  const iat = Math.floor(input.now.getTime() / 1000);
  const claims: AssertionClaims = {
    aud: input.audience ?? ASSERTION_AUDIENCE,
    exp: iat + ASSERTION_TTL_SECONDS,
    gen: input.sessionGen,
    iat,
    kid: input.kid,
    role: input.role,
    sub: input.identityId,
    uid: input.userId,
  };
  return signClaims(claims, secret);
}

export function verifyAssertion(
  token: string,
  keys: AssertionKeys,
  now: Date,
  audience = ASSERTION_AUDIENCE,
): AssertionClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const payload = parts[1];
  const signature = parts[2];
  if (!payload || !signature) return null;

  let claims: AssertionClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AssertionClaims;
  } catch {
    return null;
  }
  if (!claims || typeof claims.kid !== "string") return null;
  const secret = keys[claims.kid];
  if (!secret) return null;

  const expected = signPayload(payload, secret);
  const given = Buffer.from(signature);
  const actual = Buffer.from(expected);
  if (given.length !== actual.length || !timingSafeEqual(given, actual)) return null;

  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (claims.aud !== audience) return null;
  if (!Number.isFinite(claims.iat) || !Number.isFinite(claims.exp)) return null;
  if (claims.exp - claims.iat > ASSERTION_TTL_SECONDS) return null;
  if (claims.iat > nowSeconds + 5) return null;
  if (claims.exp <= nowSeconds - 5) return null;
  if (typeof claims.sub !== "string" || typeof claims.uid !== "string" || typeof claims.role !== "string") {
    return null;
  }
  return claims;
}

function signClaims(claims: AssertionClaims, secret: string): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `v1.${payload}.${signPayload(payload, secret)}`;
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(`v1.${payload}`).digest("base64url");
}
