export type RestoreRefusal = "missing" | "current" | "other";

/** Why a restore must be refused. Null means the selected row can become a new current version. */
export function restoreRefusal(input: {
  articleId: string;
  currentVersionId: string | null;
  selected: { id: string; articleId: string } | null;
}): RestoreRefusal | null {
  if (!input.selected) return "missing";
  if (input.selected.articleId !== input.articleId) return "other";
  if (input.currentVersionId && input.selected.id === input.currentVersionId) return "current";
  return null;
}

export function restoredFromNote(version: string): string {
  return `Restored from ${version}`;
}
