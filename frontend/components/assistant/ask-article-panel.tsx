"use client";

/**
 * "Ask about this article" (spec 20 §3 A2, §4.2): a right-side sheet that runs
 * the shared assistant thread scoped to the open article and its related set.
 * Opened by the button in the article actions row or the `a` shortcut.
 */

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ASK_ARTICLE_EVENT } from "@/components/layout/keyboard-shortcuts";
import { Composer, EmptyState, TurnCard, useAssistantThread } from "@/components/assistant/thread";

const ARTICLE_SUGGESTIONS = [
  "Does this work on Windows 10?",
  "What do I check if a step fails?",
  "Summarize the key steps",
];

export function AskArticlePanel({
  articleId,
  articleTitle,
  canDraft,
}: {
  articleId: string;
  articleTitle: string;
  canDraft: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { turns, busy, ask } = useAssistantThread({ scope: "article", articleId });
  const endRef = useRef<HTMLDivElement>(null);

  // The `a` shortcut (on an article page) opens the panel.
  useEffect(() => {
    function onAsk() {
      setOpen(true);
    }
    window.addEventListener(ASK_ARTICLE_EVENT, onAsk);
    return () => window.removeEventListener(ASK_ARTICLE_EVENT, onAsk);
  }, []);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, open]);

  const send = (question: string, mode: "answer" | "eli5" = "answer") => {
    setInput("");
    void ask(question, mode);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-sm border border-border-strong bg-surface px-3.5 text-[14px] font-semibold text-fg transition-colors hover:bg-surface-muted"
      >
        <Sparkles size={14} className="text-accent" aria-hidden />
        Ask AI
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-accent" aria-hidden /> Ask about this article
            </SheetTitle>
            <SheetDescription className="truncate">{articleTitle}</SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {turns.length === 0 ? (
              <EmptyState heading="Try asking" suggestions={ARTICLE_SUGGESTIONS} onPick={(q) => send(q)} />
            ) : (
              <div className="flex flex-col gap-5">
                {turns.map((turn) => (
                  <TurnCard
                    key={turn.id}
                    turn={turn}
                    canDraft={canDraft}
                    onEli5={() => send(turn.question, "eli5")}
                  />
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-border px-4">
            <Composer
              value={input}
              busy={busy}
              onChange={setInput}
              onSend={() => send(input)}
              hasTurns={turns.length > 0}
              placeholder="Ask about this article…"
              footer="⌘↵ to send · scoped to this article + related"
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
