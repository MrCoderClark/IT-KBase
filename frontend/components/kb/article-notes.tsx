import { deleteArticleNote, postArticleNote } from "@/lib/actions/article-notes";
import type { ArticleNoteRow } from "@/lib/queries/article-notes";

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ArticleNotes({
  slug,
  notes,
  canPost,
  userId,
  canDeleteAny,
  error,
  saved,
}: {
  slug: string;
  notes: ArticleNoteRow[];
  canPost: boolean;
  userId: string | null;
  canDeleteAny: boolean;
  error: string | null;
  saved: boolean;
}) {
  return (
    <section id="notes" className="mt-8 rounded-xl border border-border bg-surface px-4 py-4">
      <h2 className="text-[15px] leading-5 font-semibold text-fg">Field notes</h2>
      <p className="mt-1 text-[13px] leading-5 text-fg-muted">
        What happened when you ran this procedure.
      </p>

      {notes.length === 0 ? (
        <p className="mt-4 text-[13px] text-fg-subtle">No notes yet.</p>
      ) : (
        <ol className="mt-4 flex flex-col gap-3">
          {notes.map((note) => (
            <li key={note.id} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[13px] leading-5 text-fg">
                  <span className="font-semibold">{note.authorName}</span>
                  <span className="text-fg-subtle"> · {when(note.createdAt)}</span>
                </p>
                {userId && (canDeleteAny || note.authorId === userId) ? (
                  <form action={deleteArticleNote}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="noteId" value={note.id} />
                    <button
                      type="submit"
                      className="text-[12px] font-semibold text-fg-subtle hover:text-fg"
                    >
                      Delete
                    </button>
                  </form>
                ) : null}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[13px] leading-5 text-fg">{note.body}</p>
            </li>
          ))}
        </ol>
      )}

      {canPost ? (
        <form action={postArticleNote} className="mt-4">
          <input type="hidden" name="slug" value={slug} />
          <label htmlFor="article-note" className="sr-only">
            Field note
          </label>
          <textarea
            id="article-note"
            name="body"
            required
            maxLength={2000}
            rows={3}
            placeholder="Step 3 failed on 24H2. Used this command instead…"
            className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[13px] leading-5 text-fg outline-none placeholder:text-fg-subtle/70 focus:border-border-strong"
          />
          {error ? <p className="mt-2 text-[13px] text-amber-700">{error}</p> : null}
          {saved ? <p className="mt-2 text-[13px] text-fg-muted">Note saved.</p> : null}
          <button
            type="submit"
            className="mt-2 inline-flex h-8 items-center rounded-sm bg-accent px-3 text-[13px] font-semibold text-white hover:bg-accent-hover"
          >
            Add note
          </button>
        </form>
      ) : null}
    </section>
  );
}
