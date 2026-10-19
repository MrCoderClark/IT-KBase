import { normalizeEmail } from "../../../auth/web/src";
import type { Role } from "./policy";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Why a role change must be refused. `null` means the change is allowed. */
export function roleChangeBlock(input: {
  actorId: string;
  targetId: string;
  targetRole: Role;
  nextRole: Role;
  enabledAdminIds: readonly string[];
}): "self" | "last" | null {
  if (input.actorId === input.targetId && input.nextRole !== "admin") return "self";
  if (input.targetRole === "admin" && input.nextRole !== "admin") {
    const others = input.enabledAdminIds.filter((id) => id !== input.targetId);
    if (others.length === 0) return "last";
  }
  return null;
}

/** Why turning sign-in off must be refused. Turning it on is always allowed for someone else. */
export function disableSignInBlock(input: {
  actorId: string;
  targetId: string;
  targetRole: Role;
  enabledAdminIds: readonly string[];
}): "self" | "last" | null {
  if (input.actorId === input.targetId) return "self";
  if (input.targetRole !== "admin") return null;
  const others = input.enabledAdminIds.filter((id) => id !== input.targetId);
  return others.length === 0 ? "last" : null;
}

/** Delete uses the same lockout rule as turning sign-in off. */
export function deleteAccountBlock(input: {
  actorId: string;
  targetId: string;
  targetRole: Role;
  enabledAdminIds: readonly string[];
}): "self" | "last" | null {
  return disableSignInBlock(input);
}

export function accountName(raw: string): string | null {
  const name = raw.replace(/[\u0000-\u001F\u007F]/g, "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) return null;
  return name;
}

export function accountEmail(raw: string): string | null {
  const email = normalizeEmail(raw);
  if (!email || !EMAIL.test(email)) return null;
  return email;
}
