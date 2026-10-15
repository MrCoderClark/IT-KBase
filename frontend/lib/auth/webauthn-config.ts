import { COSEALG } from "@simplewebauthn/server/helpers";

/** Shown in the browser prompt. The site id and origin come from the environment. */
export const WEBAUTHN_RP_NAME = "TechBase";

/**
 * RS256, then ES256. This Node build would otherwise offer ML-DSA-44 first, which Windows Hello
 * rejects. Software-backed Windows Hello only implements RS256, and it refuses the ceremony when
 * that algorithm is missing or listed after one it does not support.
 */
export const PASSKEY_ALGORITHMS = [COSEALG.RS256, COSEALG.ES256];

export function webauthnRelyingParty(requestOrigin: string): { rpID: string; origin: string } {
  const rpID = process.env.AUTH_WEBAUTHN_RP_ID ?? (process.env.NODE_ENV === "production" ? "" : "localhost");
  const origin = process.env.AUTH_WEBAUTHN_ORIGIN ?? requestOrigin;
  if (!rpID || !origin) {
    throw new Error("AUTH_WEBAUTHN_RP_ID and AUTH_WEBAUTHN_ORIGIN are required");
  }
  return { rpID, origin };
}
