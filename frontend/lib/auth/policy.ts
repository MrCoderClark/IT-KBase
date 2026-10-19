/**
 * TechBase role matrix from Docs/specs/07-security.md.
 * The reusable auth package does not know about articles; this file does.
 */

export const ROLES = ["reader", "author", "reviewer", "admin"] as const;
export type Role = (typeof ROLES)[number];

export type Capability =
  | "article.read"
  | "article.feedback"
  | "article.create"
  | "article.editOwn"
  | "article.submit"
  | "article.editAny"
  | "article.publish"
  | "article.rollback"
  | "article.archive"
  | "article.makePublic"
  | "admin.manage";

export type ArticleStatus = "draft" | "in_review" | "published" | "archived";

const ALLOWED: Record<Capability, readonly Role[]> = {
  "article.read": ["reader", "author", "reviewer", "admin"],
  "article.feedback": ["reader", "author", "reviewer", "admin"],
  "article.create": ["author", "reviewer", "admin"],
  "article.editOwn": ["author", "reviewer", "admin"],
  "article.submit": ["author", "reviewer", "admin"],
  "article.editAny": ["reviewer", "admin"],
  "article.publish": ["reviewer", "admin"],
  "article.rollback": ["admin"],
  "article.archive": ["admin"],
  "article.makePublic": ["reviewer", "admin"],
  "admin.manage": ["admin"],
};

export function can(role: Role, capability: Capability): boolean {
  return ALLOWED[capability].includes(role);
}

/** Reviewer and admin can open version history. Restore stays `article.rollback`. */
export function canReadArticleHistory(role: Role): boolean {
  return can(role, "article.publish");
}

/** Reviewer and admin can read feedback comments. Voting stays `article.feedback`. */
export function canReviewArticleFeedback(role: Role): boolean {
  return can(role, "article.publish");
}

/** Reviewer and admin can read the per-article view trend. */
export function canReadArticleAnalytics(role: Role): boolean {
  return can(role, "article.publish");
}

/** Anonymous readers may open this article. Every other status stays private. */
export function isPublicArticle(article: {
  status: ArticleStatus;
  visibility?: "private" | "public";
}): boolean {
  return article.status === "published" && article.visibility === "public";
}

export function canEditArticle(
  role: Role,
  userId: string,
  article: { authorId: string; status: ArticleStatus },
): boolean {
  if (article.status === "archived") return can(role, "article.archive");
  if (can(role, "article.editAny")) return true;
  if (article.authorId !== userId || !can(role, "article.editOwn")) return false;
  return article.status === "draft" || article.status === "in_review";
}

/** Null when the save is allowed. Otherwise a message safe to show the user. */
export function articleSaveError(input: {
  role: Role;
  userId: string;
  existing: { authorId: string; status: ArticleStatus } | null;
  nextStatus: ArticleStatus;
  publishing: boolean;
}): string | null {
  if (!input.existing) {
    if (!can(input.role, "article.create")) {
      return "You do not have permission to create articles.";
    }
  } else if (!canEditArticle(input.role, input.userId, input.existing)) {
    return "You do not have permission to edit this article.";
  }

  const from = input.existing?.status ?? "draft";
  const to = input.publishing ? "published" : input.nextStatus;
  if (to === from) return null;

  if (to === "archived" || from === "archived") {
    return can(input.role, "article.archive")
      ? null
      : "You do not have permission to archive articles.";
  }
  if (to === "published" || from === "published") {
    return can(input.role, "article.publish")
      ? null
      : "You do not have permission to publish articles.";
  }
  if (to === "in_review") {
    return can(input.role, "article.submit") || can(input.role, "article.editAny")
      ? null
      : "You do not have permission to submit articles for review.";
  }
  return null;
}
