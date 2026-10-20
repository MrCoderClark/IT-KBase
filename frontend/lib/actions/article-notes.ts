"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const MAX_BODY = 2000;

function noteBody(raw: string): { ok: true; body: string } | { ok: false } {
  const body = raw.trim();
  if (!body || body.length > MAX_BODY) return { ok: false };
  return { ok: true, body };
}

export async function postArticleNote(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const back = `/kb/${slug}`;
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(back)}`);
  if (!can(session.role, "article.feedback")) redirect(`${back}?e=note-role#notes`);

  const article = await prisma.article.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!article) redirect("/kb");

  const parsed = noteBody(String(formData.get("body") ?? ""));
  if (!parsed.ok) redirect(`${back}?e=note#notes`);

  await prisma.articleNote.create({
    data: {
      articleId: article.id,
      authorId: session.userId,
      body: parsed.body,
    },
  });

  revalidatePath(back);
  redirect(`${back}?notice=note#notes`);
}

export async function deleteArticleNote(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const noteId = String(formData.get("noteId") ?? "");
  const back = `/kb/${slug}`;
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(back)}`);

  const note = await prisma.articleNote.findUnique({
    where: { id: noteId },
    select: { id: true, authorId: true, article: { select: { slug: true } } },
  });
  if (!note || note.article.slug !== slug) redirect(back);
  const own = note.authorId === session.userId;
  if (!own && !can(session.role, "admin.manage")) redirect(`${back}?e=note-role#notes`);

  await prisma.articleNote.delete({ where: { id: note.id } });
  revalidatePath(back);
  redirect(`${back}#notes`);
}
