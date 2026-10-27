const MAX_BYTES = 25 * 1024 * 1024;

export function sourceKindOf(name: string): "docx" | "pdf" | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".pdf")) return "pdf";
  return null;
}

export function safeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "document";
  const cleaned = base.replace(/[^\w.\- ()]+/g, "").trim();
  return (cleaned || "document").slice(0, 180);
}

export function keyOwnedBy(userId: string, key: string): boolean {
  const owner = userId.replace(/[^\w.\- ()]+/g, "") || "user";
  return key.startsWith(`uploads/${owner}/`) && !key.includes("..") && !key.includes("\\");
}

export function withinUploadLimit(size: number): boolean {
  return Number.isFinite(size) && size > 0 && size <= MAX_BYTES;
}
