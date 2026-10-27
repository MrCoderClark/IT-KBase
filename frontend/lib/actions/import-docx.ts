"use server";

import { redirect } from "next/navigation";
import { saveArticle } from "@/lib/actions/save-article";
import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { draftFromDocx } from "@/lib/ingestion/parse-docx";

export type ImportState = { error: string } | null;

const MAX_BYTES = 25 * 1024 * 1024;

export async function importDocx(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const session = await getSession();
  if (!session) return { error: "Sign in to continue." };
  if (!can(session.role, "article.create")) {
    return { error: "Your role can read articles. An author, reviewer, or admin can import one." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a Word document or a PDF." };
  }

  const filename = safeName(file.name);
  const lower = filename.toLowerCase();
  if (!lower.endsWith(".docx") && !lower.endsWith(".pdf")) {
    return { error: "Only a .docx or .pdf file can be imported." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "That file is larger than 25 MB." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const parsed = await draftFromDocx(session, filename, bytes);
  if (!parsed.ok) return { error: parsed.error };

  const saved = await saveArticle(parsed.draft, "patch", `Imported from ${filename}`);
  if (!saved.ok) return { error: saved.error };

  redirect(`/kb/${saved.slug}/edit?notice=imported`);
}

function safeName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "document.docx";
  const cleaned = base.replace(/[^\w.\- ()]+/g, "").trim();
  return (cleaned || "document.docx").slice(0, 180);
}
