const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const FEEDBACK_COMMENT_MAX = 500;

/** Empty is allowed. A comment longer than 500 characters is refused. */
export function feedbackComment(raw: string): { ok: true; comment: string | null } | { ok: false } {
  const comment = raw.replace(/\s+/g, " ").trim();
  if (comment.length > FEEDBACK_COMMENT_MAX) return { ok: false };
  return { ok: true, comment: comment.length > 0 ? comment : null };
}

export function feedbackOpenAgain(createdAt: Date): Date {
  return new Date(createdAt.getTime() + WEEK_MS);
}

export function feedbackIsCooling(createdAt: Date, now: Date): boolean {
  return feedbackOpenAgain(createdAt).getTime() > now.getTime();
}
