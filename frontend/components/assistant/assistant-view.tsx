"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Clock, Plus, Sparkles, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Composer,
  type ConversationDetail,
  EmptyState,
  type Source,
  type Turn,
  TurnCard,
  turnsFromMessages,
  useAssistantThread,
} from "@/components/assistant/thread";

type ConversationSummary = {
  id: string;
  title: string | null;
  updatedAt: string;
  messageCount: number;
};

const SUGGESTIONS = [
  "Reset a Windows 11 local admin password",
  "Retrieve a BitLocker recovery key",
  "Why is a shared mailbox missing in OWA?",
  "Join a Windows 11 device to Entra ID",
];

export function AssistantView({ canDraft }: { canDraft: boolean }) {
  const { turns, busy, ask, startNew, hydrate, conversationId } = useAssistantThread();
  const [input, setInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const prefilled = useRef(false);

  const handleNew = useCallback(() => {
    if (busy) return;
    startNew();
    setInput("");
  }, [busy, startNew]);

  const send = useCallback(
    (question: string, mode: "answer" | "eli5" = "answer") => {
      setInput("");
      void ask(question, mode);
    },
    [ask],
  );

  const loadConversation = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/assistant/conversations/${id}`);
        if (!res.ok) return;
        const detail = (await res.json()) as ConversationDetail;
        hydrate(turnsFromMessages(detail.messages), detail.id);
        setHistoryOpen(false);
      } catch {
        /* best-effort: leave the current thread in place */
      }
    },
    [hydrate],
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
            <HeaderButton onClick={handleNew} disabled={busy || turns.length === 0}>
              <Plus className="size-3.5" aria-hidden /> New
            </HeaderButton>
            <HeaderButton onClick={() => setHistoryOpen(true)}>
              <Clock className="size-3.5" aria-hidden /> History
            </HeaderButton>
          </div>
        </header>

        {turns.length === 0 ? (
          <EmptyState suggestions={SUGGESTIONS} onPick={(q) => send(q)} />
        ) : (
          <div className="flex flex-col gap-6">
            {turns.map((turn) => (
              <TurnCard key={turn.id} turn={turn} canDraft={canDraft} onEli5={() => send(turn.question, "eli5")} />
            ))}
          </div>
        )}
        <div ref={endRef} />

        <Composer value={input} busy={busy} onChange={setInput} onSend={() => send(input)} hasTurns={turns.length > 0} />
      </div>

      <SourcesRail turn={latest} />

      <HistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        activeId={conversationId.current}
        onPick={(id) => void loadConversation(id)}
        onDeleteActive={handleNew}
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

function SourcesRail({ turn }: { turn: Turn | undefined }) {
  return (
    <aside className="hidden w-[320px] shrink-0 lg:block">
      <div className="sticky top-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-subtle">Sources</h2>
        {turn && turn.sources.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {turn.sources.map((s: Source) => (
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
