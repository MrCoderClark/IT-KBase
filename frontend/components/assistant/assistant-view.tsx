"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowUp,
  Clock,
  ExternalLink,
  FileText,
  Plus,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { CodeBlock } from "@/components/kb/code-block";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Source = { n: number; slug: string; title: string; sectionAnchor: string; versionId: string };
type Nearest = { slug: string; title: string };
type TurnStatus = "retrieving" | "streaming" | "done" | "failed";

type Turn = {
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

type ConversationSummary = {
  id: string;
  title: string | null;
  updatedAt: string;
  messageCount: number;
};

type StoredCitation = Source & { articleId?: string };

type ConvMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: unknown;
  grounded: boolean;
  helpful: boolean | null;
};

type ConversationDetail = { id: string; messages: ConvMessage[] };

const SUGGESTIONS = [
  "Reset a Windows 11 local admin password",
  "Retrieve a BitLocker recovery key",
  "Why is a shared mailbox missing in OWA?",
  "Join a Windows 11 device to Entra ID",
];

/** Rebuild the on-screen thread from a stored conversation's turns. */
function turnsFromMessages(messages: ConvMessage[]): Turn[] {
  const turns: Turn[] = [];
  let pending: Turn | null = null;
  for (const m of messages) {
    if (m.role === "user") {
      if (pending) turns.push(pending);
      pending = {
        id: m.id,
        question: m.content,
        answer: "",
        sources: [],
        nearest: [],
        grounded: null,
        status: "done",
        articles: 0,
        chunks: 0,
      };
    } else {
      const stored = Array.isArray(m.citations) ? (m.citations as StoredCitation[]) : [];
      const sources: Source[] = stored.map((c) => ({
        n: c.n,
        slug: c.slug,
        title: c.title,
        sectionAnchor: c.sectionAnchor,
        versionId: c.versionId,
      }));
      const base: Turn = pending ?? {
        id: m.id,
        question: "",
        answer: "",
        sources: [],
        nearest: [],
        grounded: null,
        status: "done",
        articles: 0,
        chunks: 0,
      };
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

export function AssistantView({ canDraft }: { canDraft: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const conversationId = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const prefilled = useRef(false);

  const startNew = useCallback(() => {
    if (busy) return;
    conversationId.current = null;
    setTurns([]);
    setInput("");
  }, [busy]);

  const loadConversation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/assistant/conversations/${id}`);
      if (!res.ok) return;
      const detail = (await res.json()) as ConversationDetail;
      conversationId.current = detail.id;
      setTurns(turnsFromMessages(detail.messages));
      setHistoryOpen(false);
    } catch {
      /* best-effort: leave the current thread in place */
    }
  }, []);

  const ask = useCallback(
    async (question: string, mode: "answer" | "eli5" = "answer") => {
      const trimmed = question.trim();
      if (!trimmed || busy) return;
      setBusy(true);
      setInput("");
      const id = crypto.randomUUID();
      setTurns((prev) => [
        ...prev,
        { id, question: trimmed, answer: "", sources: [], nearest: [], grounded: null, status: "retrieving", articles: 0, chunks: 0 },
      ]);

      const apply = (patch: (t: Turn) => Turn) =>
        setTurns((prev) => prev.map((t) => (t.id === id ? patch(t) : t)));

      try {
        const res = await fetch("/api/assistant/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmed, conversationId: conversationId.current, mode }),
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
    [busy],
  );

  // Submit a ?q= from the command palette once.
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !prefilled.current) {
      prefilled.current = true;
      void ask(q);
    }
  }, [searchParams, ask]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  const latest = turns[turns.length - 1];

  return (
    <div className="mx-auto flex w-full max-w-[1120px] gap-6 px-4 py-6 lg:px-8">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-[22px] font-semibold text-fg">
              <Sparkles className="size-5 text-accent" aria-hidden /> Ask the knowledge base
            </h1>
            <p className="mt-1 text-[13px] text-fg-muted">Answers come only from articles you can open.</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <HeaderButton onClick={startNew} disabled={busy || turns.length === 0}>
              <Plus className="size-3.5" aria-hidden /> New
            </HeaderButton>
            <HeaderButton onClick={() => setHistoryOpen(true)}>
              <Clock className="size-3.5" aria-hidden /> History
            </HeaderButton>
          </div>
        </header>

        {turns.length === 0 ? (
          <EmptyState onPick={(q) => void ask(q)} />
        ) : (
          <div className="flex flex-col gap-6">
            {turns.map((turn) => (
              <TurnCard key={turn.id} turn={turn} canDraft={canDraft} onEli5={() => void ask(turn.question, "eli5")} />
            ))}
          </div>
        )}
        <div ref={endRef} />

        <Composer value={input} busy={busy} onChange={setInput} onSend={() => void ask(input)} hasTurns={turns.length > 0} />
      </div>

      <SourcesRail turn={latest} />

      <HistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        activeId={conversationId.current}
        onPick={(id) => void loadConversation(id)}
        onDeleteActive={startNew}
      />
    </div>
  );
}

function HeaderButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-fg-muted transition enabled:hover:bg-surface-muted enabled:hover:text-fg disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function HistoryDialog({
  open,
  onOpenChange,
  activeId,
  onPick,
  onDeleteActive,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeId: string | null;
  onPick: (id: string) => void;
  onDeleteActive: () => void;
}) {
  const [items, setItems] = useState<ConversationSummary[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = useCallback(async (nextCursor: string | null) => {
    setLoading(true);
    try {
      const url = nextCursor
        ? `/api/assistant/conversations?cursor=${encodeURIComponent(nextCursor)}`
        : "/api/assistant/conversations";
      const res = await fetch(url);
      if (!res.ok) {
        setItems((prev) => prev ?? []);
        return;
      }
      const page = (await res.json()) as {
        conversations: ConversationSummary[];
        nextCursor: string | null;
      };
      setItems((prev) => (nextCursor && prev ? [...prev, ...page.conversations] : page.conversations));
      setCursor(page.nextCursor);
    } catch {
      setItems((prev) => prev ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setConfirmId(null);
      void load(null);
    } else {
      setItems(null);
      setCursor(null);
    }
  }, [open, load]);

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/assistant/conversations/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) return;
    } catch {
      return;
    }
    setItems((prev) => (prev ? prev.filter((c) => c.id !== id) : prev));
    setConfirmId(null);
    if (id === activeId) onDeleteActive();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Your conversations</DialogTitle>
          <DialogDescription>Pick up a past question or clear one out.</DialogDescription>
        </DialogHeader>
        <div className="-mx-1 max-h-[55vh] overflow-y-auto px-1">
          {items === null ? (
            <p className="py-6 text-center text-[13px] text-fg-subtle">Loading…</p>
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-fg-subtle">No conversations yet.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {items.map((c) => (
                <li
                  key={c.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2",
                    c.id === activeId ? "border-accent bg-accent-soft" : "border-border",
                  )}
                >
                  <button type="button" onClick={() => onPick(c.id)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-[13px] font-medium text-fg">
                      {c.title ?? "Untitled"}
                    </span>
                    <span className="block text-[11px] text-fg-subtle">
                      {relativeTime(c.updatedAt)} · {c.messageCount} message{c.messageCount === 1 ? "" : "s"}
                    </span>
                  </button>
                  {confirmId === c.id ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void remove(c.id)}
                        className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-700"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="rounded-md border border-border px-2 py-1 text-[11px] text-fg-muted hover:bg-surface-muted"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(c.id)}
                      aria-label="Delete conversation"
                      className="shrink-0 rounded-md p-1.5 text-fg-subtle transition hover:bg-surface-muted hover:text-red-600"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {cursor ? (
            <div className="pt-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => void load(cursor)}
                className="w-full rounded-lg border border-border py-2 text-[12px] text-fg-muted hover:bg-surface-muted disabled:opacity-50"
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function relativeTime(iso: string): string {
  const delta = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
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

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <p className="text-[13px] font-medium text-fg">Try one of these</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
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

function TurnCard({ turn, canDraft, onEli5 }: { turn: Turn; canDraft: boolean; onEli5: () => void }) {
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

function Composer({
  value,
  busy,
  onChange,
  onSend,
  hasTurns,
}: {
  value: string;
  busy: boolean;
  onChange: (v: string) => void;
  onSend: () => void;
  hasTurns: boolean;
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
          placeholder="Ask a follow-up…"
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
      <p className="mt-1.5 px-1 text-[11px] text-fg-subtle">⌘↵ to send · answers are grounded in your knowledge base</p>
    </div>
  );
}

function SourcesRail({ turn }: { turn: Turn | undefined }) {
  return (
    <aside className="hidden w-[320px] shrink-0 lg:block">
      <div className="sticky top-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-subtle">Sources</h2>
        {turn && turn.sources.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {turn.sources.map((s) => (
              <li key={s.n}>
                <Link
                  href={`/kb/${s.slug}#${s.sectionAnchor}`}
                  className="flex gap-2 rounded-lg border border-border bg-surface p-2.5 transition hover:border-border-strong"
                >
                  <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
                    {s.n}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-fg">{s.title}</span>
                    <span className="block truncate text-[12px] text-fg-muted">§{s.sectionAnchor.replace(/-/g, " ")}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[13px] text-fg-subtle">Citations appear here as the assistant answers.</p>
        )}
      </div>
    </aside>
  );
}
