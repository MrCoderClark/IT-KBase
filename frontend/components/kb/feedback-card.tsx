"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { submitArticleFeedback } from "@/lib/actions/article-feedback";

export function FeedbackCard({
  slug,
  helpful,
  notHelpful,
  mine,
  notice,
}: {
  slug: string;
  helpful: number;
  notHelpful: number;
  mine: { helpful: boolean; openAgainLabel: string } | null;
  notice: string | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <h3 className="text-[16px] leading-6 font-semibold text-fg">Was this article helpful?</h3>
      <p className="mt-1 text-[13px] leading-5 text-fg-subtle">
        {helpful} helpful · {notHelpful} not helpful
      </p>
      {notice ? <p className="mt-2 text-[13px] text-fg">{notice}</p> : null}
      {mine ? (
        <p className="mt-3 text-[13px] leading-5 text-fg">
          You said this was {mine.helpful ? "helpful" : "not helpful"}. You can vote again on {mine.openAgainLabel}.
        </p>
      ) : (
        <form action={submitArticleFeedback} className="mt-3">
          <input type="hidden" name="slug" value={slug} />
          <label className="block text-[12px] font-semibold text-fg-muted" htmlFor={`feedback-${slug}`}>
            Comment, optional
          </label>
          <textarea
            id={`feedback-${slug}`}
            name="comment"
            maxLength={500}
            rows={3}
            className="mt-1 w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[13px] text-fg"
            placeholder="What should we change?"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="submit"
              name="helpful"
              value="yes"
              aria-label="Helpful"
              className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-border-strong px-2.5 text-[13px] font-semibold text-fg-subtle transition-colors hover:bg-surface-muted hover:text-fg"
            >
              <ThumbsUp size={16} aria-hidden />
              Helpful
            </button>
            <button
              type="submit"
              name="helpful"
              value="no"
              aria-label="Not helpful"
              className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-border-strong px-2.5 text-[13px] font-semibold text-fg-subtle transition-colors hover:bg-surface-muted hover:text-fg"
            >
              <ThumbsDown size={16} aria-hidden />
              Not helpful
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
