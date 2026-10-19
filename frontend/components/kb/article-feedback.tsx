import Link from "next/link";
import { FeedbackCard } from "@/components/kb/feedback-card";
import { getSession, requestTime } from "@/lib/auth/session";
import { getMyArticleFeedback, listArticleFeedback, type FeedbackNote } from "@/lib/queries/feedback";

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export async function ArticleFeedback({
  articleId,
  slug,
  helpful,
  notHelpful,
  notice,
}: {
  articleId: string;
  slug: string;
  helpful: number;
  notHelpful: number;
  notice: string | null;
}) {
  const session = await getSession();
  const mine = session ? await getMyArticleFeedback(articleId, session.userId, await requestTime()) : null;
  return (
    <FeedbackCard
      slug={slug}
      helpful={helpful}
      notHelpful={notHelpful}
      notice={notice}
      mine={mine ? { helpful: mine.helpful, openAgainLabel: when(mine.openAgain) } : null}
    />
  );
}

export async function ArticleFeedbackNotes({ articleId }: { articleId: string }) {
  const notes = await listArticleFeedback(articleId);
  return <FeedbackNotes notes={notes} />;
}

export function FeedbackNotes({ notes, showArticle = false }: { notes: FeedbackNote[]; showArticle?: boolean }) {
  if (notes.length === 0) {
    return <p className="text-[13px] text-fg-muted">No written votes yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {notes.map((note) => (
        <li key={note.id} className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px]">
          <p className="font-semibold text-fg">
            {note.authorName}
            <span className="ml-2 font-medium text-fg-muted">{note.helpful ? "Helpful" : "Not helpful"}</span>
            <span className="ml-2 font-normal text-fg-muted">{when(note.createdAt)}</span>
          </p>
          {showArticle && note.articleSlug ? (
            <p className="mt-1">
              <Link href={`/kb/${note.articleSlug}`} className="font-semibold text-accent hover:underline">
                {note.articleTitle}
              </Link>
            </p>
          ) : null}
          {note.comment ? <p className="mt-1 text-fg">{note.comment}</p> : null}
        </li>
      ))}
    </ul>
  );
}
