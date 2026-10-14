import { mintAssertion, parseAssertionKeys } from "../../../auth/web/src/assertion";
import { prisma } from "@/lib/db";
import type { AppSession } from "./session";

/**
 * Mint the 60-second bearer token FastAPI expects.
 * Returns null when `AUTH_ASSERTION_KEYS` is unset, so local ingest can stay off.
 * Keys use the same `kid:secret` string as `TB_ASSERTION_KEYS` on the Python side.
 */
export async function mintIngestionAssertion(
  session: AppSession,
  now: Date,
): Promise<string | null> {
  const keys = parseAssertionKeys(process.env.AUTH_ASSERTION_KEYS);
  const kid = process.env.AUTH_ASSERTION_KID ?? Object.keys(keys)[0];
  if (!kid || !keys[kid]) return null;

  const identity = await prisma.identity.findUnique({
    where: { id: session.identityId },
    select: { sessionGen: true },
  });
  if (!identity) return null;

  return mintAssertion({
    keys,
    kid,
    identityId: session.identityId,
    userId: session.userId,
    role: session.role,
    sessionGen: identity.sessionGen,
    now,
  });
}
