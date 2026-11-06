"use client";

/**
 * Shared assistant thread: the SSE streaming hook plus the presentational
 * pieces used by both the full `/assistant` page and the in-article sheet panel
 * (spec 20 §3 A1/A2/A5). Keeping one implementation here means the stream
 * parsing and the answer rendering never drift between the two surfaces.
 */

import { Fragment, useCallback, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, ExternalLink, FileText, ThumbsDown, ThumbsUp } from "lucide-react";
import { CodeBlock } from "@/components/kb/code-block";
import { cn } from "@/lib/utils";

export type Source = {
  n: number;
  slug: string;
  title: string;
  sectionAnchor: string;
  versionId: string;
};
export type Nearest = { slug: string; title: string };
export type TurnStatus = "retrieving" | "streaming" | "done" | "failed";
export type AssistantMode = "answer" | "eli5" | "command";

export type Turn = {
  id: string;
  question: string;
  answer: string;
  sources: Source[];
  nearest: Nearest[];
  grounded: boolean | null;
  status: TurnStatus;
  error?: string;
  messageId?: string;
  helpful?: boolean | null;
  articles: number;
  chunks: number;
};

type StoredCitation = Source & { articleId?: string };

export type ConvMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: unknown;
  grounded: boolean;
  helpful: boolean | null;
};

export type ConversationDetail = { id: string; messages: ConvMessage[] };

/** Rebuild the on-screen thread from a stored conversation's turns. */
export function turnsFromMessages(messages: ConvMessage[]): Turn[] {
  const turns: Turn[] = [];
  let pending: Turn | null = null;
  for (const m of messages) {
    if (m.role === "user") {
      if (pending) turns.push(pending);
      pending = blankTurn(m.id, m.content);
    } else {
      const stored = Array.isArray(m.citations) ? (m.citations as StoredCitation[]) : [];
      const sources: Source[] = stored.map((c) => ({
        n: c.n,
        slug: c.slug,
        title: c.title,
        sectionAnchor: c.sectionAnchor,
        versionId: c.versionId,
      }));
      const base: Turn = pending ?? blankTurn(m.id, "");
      turns.push({
        ...base,
        answer: m.content,
        sources,
        grounded: m.grounded,
        status: "done",
        messageId: m.id,
        helpful: m.helpful,
        articles: new Set(stored.map((c) => c.articleId).filter(Boolean)).size,
        chunks: sources.length,
      });
      pending = null;
    }
  }
  if (pending) turns.push(pending);
  return turns;
}

function blankTurn(id: string, question: string): Turn {
  return {
    id,
    question,
    answer: "",
    sources: [],
    nearest: [],
    grounded: null,
    status: "done",
    articles: 0,
    chunks: 0,
  };
}

export type UseAssistantThread = {
  turns: Turn[];
  busy: boolean;
  ask: (question: string, mode?: AssistantMode) => Promise<void>;
  startNew: () => void;
  hydrate: (turns: Turn[], conversationId: string | null) => void;
  conversationId: React.RefObject<string | null>;
};

/**
 * Drives one assistant thread against `POST /api/assistant/messages`. Pass a
 * `scope`/`articleId` to run the in-article variant (A2).
 */
export function useAssistantThread(opts?: {
  scope?: "library" | "article";
  articleId?: string;
}): UseAssistantThread {
  const scope = opts?.scope;
  const articleId = opts?.articleId;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const conversationId = useRef<string | null>(null);

  const ask = useCallback(
    async (question: string, mode: AssistantMode = "answer") => {
      const trimmed = question.trim();
      if (!trimmed || busy) return;
      setBusy(true);
      const id = crypto.randomUUID();
      setTurns((prev) => [
        ...prev,
        {
          id,
          question: trimmed,
          answer: "",
          sources: [],
          nearest: [],
          grounded: null,
          status: "retrieving",
          articles: 0,
          chunks: 0,
        },
      ]);

      const apply = (patch: (t: Turn) => Turn) =>
        setTurns((prev) => prev.map((t) => (t.id === id ? patch(t) : t)));

      try {
        const res = await fetch("/api/assistant/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: trimmed,
            conversationId: conversationId.current,
            mode,
            scope,
            articleId,
          }),
        });
        if (!res.ok || !res.body) {
          const message =
            res.status === 429
              ? "You've reached the assistant limit. Try again later."
              : "The assistant couldn't answer. Try again.";
          apply((t) => ({ ...t, status: "failed", error: message }));
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() ?? "";
          for (const block of blocks) applyEvent(block, apply, conversationId);
        }
      } catch {
        apply((t) => ({ ...t, status: "failed", error: "The connection dropped. Try again." }));
      } finally {
        setBusy(false);
      }
    },
    [busy, scope, articleId],
  );

  const startNew = useCallback(() => {
    conversationId.current = null;
    setTurns([]);
  }, []);

  const hydrate = useCallback((newTurns: Turn[], convId: string | null) => {
    conversationId.current = convId;
    setTurns(newTurns);
  }, []);

  return { turns, busy, ask, startNew, hydrate, conversationId };
}

function applyEvent(
  block: string,
  apply: (patch: (t: Turn) => Turn) => void,
  conversationId: { current: string | null },
) {
  let event = "";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (!event || dataLines.length === 0) return;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(dataLines.join("\n"));
  } catch {
    return;
  }

  switch (event) {
    case "retrieval":
      apply((t) => ({ ...t, articles: Number(data.articles) || 0, chunks: Number(data.chunks) || 0 }));
      break;
    case "citation":
      apply((t) => ({ ...t, sources: [...t.sources, data as unknown as Source] }));
      break;
    case "token":
      apply((t) => ({
        ...t,
        answer: t.answer + String((data as { text?: string }).text ?? ""),
        status: "streaming",
      }));
      break;
    case "done": {
      conversationId.current = (data.conversationId as string) ?? conversationId.current;
      const citedN = Array.isArray(data.citedN) ? (data.citedN as number[]) : null;
      apply((t) => ({
        ...t,
        // Collapse the rail from all retrieved candidates to the ones the
        // answer actually cited, so live matches the reloaded-from-history view.
        sources: citedN ? t.sources.filter((s) => citedN.includes(s.n)) : t.sources,
        grounded: Boolean(data.grounded),
        nearest: (data.nearest as Nearest[]) ?? [],
        messageId: data.messageId as string,
        status: "done",
      }));
      break;
    }
    case "failed":
      apply((t) => ({ ...t, status: "failed", error: String((data as { message?: string }).message ?? "Failed.") }));
      break;
  }
}

export function EmptyState({
  heading = "Try one of these",
  suggestions,
  onPick,
}: {
  heading?: string;
  suggestions: string[];
  onPick: (q: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <p className="text-[13px] font-medium text-fg">{heading}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-lg border border-border bg-surface-muted px-3.5 py-2.5 text-left text-[13px] text-fg transition hover:border-border-strong hover:bg-accent-soft"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TurnCard({
  turn,
  canDraft,
  onEli5,
}: {
  turn: Turn;
  canDraft: boolean;
  onEli5: () => void;
}) {
  return (
    <div>
      <p className="mb-2 text-[14px] font-semibold text-fg">{turn.question}</p>
      <div className="rounded-xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,.06),0_8px_24px_rgba(15,23,42,.06)]">
        {turn.status === "retrieving" && !turn.answer ? (
          <p className="text-[13px] text-fg-muted">Searching {turn.articles || "the"} articles…</p>
        ) : null}

        {turn.status === "failed" ? (
          <p className="text-[13px] text-red-600">{turn.error}</p>
        ) : turn.grounded === false ? (
          <NotInKb turn={turn} canDraft={canDraft} />
        ) : (
          turn.answer && <AnswerBody text={turn.answer} sources={turn.sources} />
        )}

        {turn.status === "done" && turn.grounded ? (
          <AnswerActions turn={turn} onEli5={onEli5} />
        ) : null}
      </div>
    </div>
  );
}

function NotInKb({ turn, canDraft }: { turn: Turn; canDraft: boolean }) {
  return (
    <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-4 dark:bg-amber-500/10">
      <p className="text-[13px] font-medium text-fg">Not in the knowledge base</p>
      <p className="mt-1 text-[13px] text-fg-muted">
        I couldn&apos;t find an answer in the articles you can open.
      </p>
      {turn.nearest.length > 0 ? (
        <div className="mt-2 text-[13px]">
          <span className="text-fg-muted">Closest articles: </span>
          {turn.nearest.map((n, i) => (
            <Fragment key={n.slug}>
              {i > 0 ? ", " : ""}
              <Link href={`/kb/${n.slug}`} className="text-accent hover:underline">
                {n.title}
              </Link>
            </Fragment>
          ))}
        </div>
      ) : null}
      <div className="mt-3">
        {canDraft ? (
          <Link
            href={`/create?title=${encodeURIComponent(turn.question)}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:bg-accent-hover"
          >
            <FileText className="size-3.5" aria-hidden /> Draft this article
          </Link>
        ) : (
          <span className="text-[12px] text-fg-subtle">We&apos;ve logged this as a coverage gap.</span>
        )}
      </div>
    </div>
  );
}

function AnswerActions({ turn, onEli5 }: { turn: Turn; onEli5: () => void }) {
  const [helpful, setHelpful] = useState<boolean | null>(turn.helpful ?? null);
  const vote = async (value: boolean) => {
    if (!turn.messageId) return;
    setHelpful(value);
    try {
      await fetch(`/api/assistant/messages/${turn.messageId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ helpful: value }),
      });
    } catch {
      /* best-effort */
    }
  };
  const topSlug = turn.sources[0]?.slug;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
      <IconToggle active={helpful === true} label="Helpful" onClick={() => void vote(true)}>
        <ThumbsUp className="size-3.5" aria-hidden />
      </IconToggle>
      <IconToggle active={helpful === false} label="Not helpful" onClick={() => void vote(false)}>
        <ThumbsDown className="size-3.5" aria-hidden />
      </IconToggle>
      <button
        type="button"
        onClick={onEli5}
        className="rounded-lg border border-border px-2.5 py-1 text-[12px] text-fg-muted hover:bg-surface-muted"
      >
        Explain like I&apos;m L1
      </button>
      {topSlug ? (
        <Link
          href={`/kb/${topSlug}`}
          className="ml-auto inline-flex items-center gap-1 text-[12px] text-accent hover:underline"
        >
          Open {topSlug} <ExternalLink className="size-3" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

function IconToggle({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-lg border transition",
        active ? "border-accent bg-accent-soft text-accent" : "border-border text-fg-muted hover:bg-surface-muted",
      )}
    >
      {children}
    </button>
  );
}

const CODE_FENCE = /```(\w+)?\n?([\s\S]*?)```/g;

function AnswerBody({ text, sources }: { text: string; sources: Source[] }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(CODE_FENCE)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(<Prose key={key++} text={text.slice(last, index)} sources={sources} />);
    parts.push(<CodeBlock key={key++} code={match[2].trim()} language={match[1]} className="my-3" />);
    last = index + match[0].length;
  }
  if (last < text.length) parts.push(<Prose key={key++} text={text.slice(last)} sources={sources} />);
  return <div className="text-[14px] leading-relaxed text-fg">{parts}</div>;
}

const CITATION = /\[(\d+)\]/g;

function Prose({ text, sources }: { text: string; sources: Source[] }) {
  return (
    <>
      {text.split("\n\n").map((para, i) => (
        <p key={i} className="mb-2 last:mb-0">
          {withCitations(para, sources)}
        </p>
      ))}
    </>
  );
}

function withCitations(text: string, sources: Source[]): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(CITATION)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    const n = Number(match[1]);
    const source = sources.find((s) => s.n === n);
    nodes.push(
      source ? (
        <Link
          key={key++}
          href={`/kb/${source.slug}#${source.sectionAnchor}`}
          title={`${source.title} — ${source.sectionAnchor}`}
          className="mx-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-accent-soft px-1.5 text-[11px] font-semibold text-accent align-baseline hover:bg-accent hover:text-white"
        >
          {n}
        </Link>
      ) : (
        <span key={key++}>[{n}]</span>
      ),
    );
    last = index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Composer({
  value,
  busy,
  onChange,
  onSend,
  hasTurns,
  placeholder = "Ask a follow-up…",
  footer = "⌘↵ to send · answers are grounded in your knowledge base",
}: {
  value: string;
  busy: boolean;
  onChange: (v: string) => void;
  onSend: () => void;
  hasTurns: boolean;
  placeholder?: string;
  footer?: string;
}) {
  return (
    <div className={cn("sticky bottom-0 bg-canvas pb-1 pt-4", hasTurns ? "mt-6" : "mt-4")}>
      <div className="flex items-end gap-2 rounded-xl border border-border bg-surface p-2 shadow-[0_1px_2px_rgba(15,23,42,.06)] focus-within:border-border-strong">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onSend();
            }
          }}
          rows={1}
          placeholder={placeholder}
          className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[14px] text-fg outline-none placeholder:text-fg-subtle"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={busy || !value.trim()}
          aria-label="Send"
          className="inline-flex size-9 items-center justify-center rounded-lg bg-accent text-white transition enabled:hover:bg-accent-hover disabled:opacity-40"
        >
          <ArrowUp className="size-4" aria-hidden />
        </button>
      </div>
      <p className="mt-1.5 px-1 text-[11px] text-fg-subtle">{footer}</p>
    </div>
  );
}
