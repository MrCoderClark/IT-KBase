import { prisma } from "@/lib/db";

export type ArticleNoteRow = {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorName: string;
};

export async function listArticleNotes(articleId: string): Promise<ArticleNoteRow[]> {
  const rows = await prisma.articleNote.findMany({
    where: { articleId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      createdAt: true,
      authorId: true,
      author: { select: { name: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    authorId: row.authorId,
    authorName: row.author.name,
  }));
}
