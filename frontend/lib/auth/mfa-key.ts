export const MFA_ISSUER = "TechBase";

export function mfaKey(): string | null {
  const key = process.env.AUTH_MFA_KEY?.trim();
  return key ? key : null;
}
