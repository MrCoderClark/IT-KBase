import { createHash } from "node:crypto";

/**
 * Shape + HIBP live here (no npm deps). zxcvbn stays in the host — Turbopack
 * resolves packages from frontend/node_modules, and auth/web sits outside that tree.
 */
export type PasswordPolicyOptions = {
  /** Required for the full bar. Host supplies zxcvbn (score 0–4; need ≥ 3). */
  score: (password: string) => number;
  /** Override HIBP. Tests stub this. True means the password is in a breach. */
  isBreached?: (password: string) => Promise<boolean>;
};

/** Human-facing rules for forms. Keep in sync with the checks below and Docs/specs/07-security.md. */
export const PASSWORD_POLICY_RULES = [
  "At least 12 characters",
  "At least three of: uppercase, lowercase, a digit, a symbol",
  "Strong enough to avoid common words and simple patterns",
  "Not found in a known breach list",
] as const;

export const PASSWORD_POLICY_SUMMARY =
  "Use at least 12 characters, three character classes, a strong rating, and a password that is not in a known breach.";

/** Length and character-class rules only (sync). */
export function passwordShapeProblem(password: string): string | null {
  if (password.length < 12) return "Use at least 12 characters.";
  if (password.length > 128) return "Use 128 characters or fewer.";

  let classes = 0;
  if (/[a-z]/.test(password)) classes += 1;
  if (/[A-Z]/.test(password)) classes += 1;
  if (/\d/.test(password)) classes += 1;
  if (/[^A-Za-z0-9]/.test(password)) classes += 1;
  if (classes < 3) {
    return "Use at least three of uppercase, lowercase, a digit, and a symbol.";
  }
  return null;
}

/** Have I Been Pwned range API (k-anonymity). Fail closed on network errors. */
export async function isPasswordBreached(password: string): Promise<boolean> {
  const hash = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: {
      "Add-Padding": "true",
      "User-Agent": "TechBase-auth-web",
    },
  });
  if (!response.ok) {
    throw new Error(`HIBP range lookup failed (${response.status})`);
  }
  const body = await response.text();
  for (const line of body.split("\n")) {
    const [entry] = line.trim().split(":");
    if (entry && entry.toUpperCase() === suffix) return true;
  }
  return false;
}

/**
 * Full password bar from the security spec: shape, zxcvbn ≥ 3, not in HIBP.
 * Pass `score` from the host (`@zxcvbn-ts/*` in frontend/).
 */
export async function passwordProblem(
  password: string,
  options: PasswordPolicyOptions,
): Promise<string | null> {
  const shape = passwordShapeProblem(password);
  if (shape) return shape;

  if (options.score(password) < 3) {
    return "Choose a stronger password. Avoid common words and simple patterns.";
  }

  try {
    const breached = await (options.isBreached ?? isPasswordBreached)(password);
    if (breached) {
      return "That password appears in a known breach. Choose a different one.";
    }
  } catch {
    return "Could not verify the password against the breach list. Try again in a moment.";
  }

  return null;
}
