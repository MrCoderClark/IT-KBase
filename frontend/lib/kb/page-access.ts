import type { Role } from "@/lib/auth/policy";

export type ArticleAccessMode = "inherit" | "library" | "role_floor";

/** Floors offered in the UI (reader floor ≡ library for signed-in users). */
export type AccessRoleFloor = "author" | "reviewer" | "admin";

export type PageAccessNode = {
  id: string;
  parentId: string | null;
  title: string;
  accessMode: ArticleAccessMode;
  accessRoleFloor: Role | null;
};

export type EffectivePageAccess = {
  /** Resolved mode after walking inherit. Never `inherit`. */
  mode: "library" | "role_floor";
  roleFloor: AccessRoleFloor | null;
  /** Article that defined the effective rule; null when library-by-default. */
  sourceArticleId: string | null;
  sourceTitle: string | null;
};

const ROLE_RANK: Record<Role, number> = {
  reader: 0,
  author: 1,
  reviewer: 2,
  admin: 3,
};

export function roleRank(role: Role): number {
  return ROLE_RANK[role];
}

export function isAccessRoleFloor(value: string | null | undefined): value is AccessRoleFloor {
  return value === "author" || value === "reviewer" || value === "admin";
}

/**
 * Walk parents until a non-inherit mode is found. Cycle-safe.
 * Missing nodes or all-inherit → library.
 */
export function resolveEffectiveAccess(
  articleId: string,
  index: ReadonlyMap<string, PageAccessNode>,
): EffectivePageAccess {
  const visited = new Set<string>();
  let currentId: string | null = articleId;

  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);
    const node = index.get(currentId);
    if (!node) break;

    if (node.accessMode === "library") {
      return {
        mode: "library",
        roleFloor: null,
        sourceArticleId: node.id,
        sourceTitle: node.title,
      };
    }
    if (node.accessMode === "role_floor" && isAccessRoleFloor(node.accessRoleFloor)) {
      return {
        mode: "role_floor",
        roleFloor: node.accessRoleFloor,
        sourceArticleId: node.id,
        sourceTitle: node.title,
      };
    }
    // inherit or invalid floor → keep walking
    currentId = node.parentId;
  }

  return {
    mode: "library",
    roleFloor: null,
    sourceArticleId: null,
    sourceTitle: null,
  };
}

/** Page gate only (status/authorship checked separately). Admin always passes. */
export function passesPageGate(role: Role, effective: EffectivePageAccess): boolean {
  if (role === "admin") return true;
  if (effective.mode === "library") return true;
  if (effective.mode === "role_floor" && effective.roleFloor) {
    return roleRank(role) >= roleRank(effective.roleFloor);
  }
  return true;
}

export function accessFloorLabel(floor: AccessRoleFloor): string {
  if (floor === "author") return "Author or above";
  if (floor === "reviewer") return "Reviewer or above";
  return "Admin only";
}

export function effectiveAccessLabel(effective: EffectivePageAccess): string {
  if (effective.mode === "library") {
    return effective.sourceArticleId
      ? `Library default (from ${effective.sourceTitle ?? "parent"})`
      : "Library default";
  }
  const floor = effective.roleFloor ? accessFloorLabel(effective.roleFloor) : "Role floor";
  if (effective.sourceArticleId && effective.sourceTitle) {
    return `${floor} (from ${effective.sourceTitle})`;
  }
  return floor;
}
