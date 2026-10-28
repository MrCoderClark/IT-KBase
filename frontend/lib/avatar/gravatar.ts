import { createHash } from "node:crypto";

/**
 * Gravatar URL for an email. SHA-256 per https://docs.gravatar.com/rest/hash/
 *
 * `d=identicon` always returns a face from Gravatar’s CDN (needed for
 * `@techbase.local` seed emails that will never have a real profile). A
 * photo uploaded at gravatar.com for that email replaces the identicon.
 */
export function gravatarUrl(
  email: string,
  size = 80,
  fallback: "identicon" | "mp" | "404" = "identicon",
): string {
  const hash = createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex");
  const s = Math.min(512, Math.max(16, Math.round(size)));
  return `https://www.gravatar.com/avatar/${hash}?s=${s}&d=${fallback}&r=g`;
}

/** Prefer a stored avatar, then Gravatar, else null (caller shows initials). */
export function resolveAvatarSrc(
  email: string | null | undefined,
  avatarUrl: string | null | undefined,
  size = 80,
): string | null {
  if (avatarUrl?.trim()) return avatarUrl.trim();
  if (email?.trim()) return gravatarUrl(email, size);
  return null;
}
