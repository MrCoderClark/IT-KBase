"use client";

/**
 * "Ask about this article" (spec 20 §3 A2/A6, §4.2): a right-side sheet with two
 * modes — a chat scoped to the open article and its related set, and a guided
 * troubleshooting checklist built from the article's steps. Opened by the button
 * in the article actions row or the `a` shortcut.
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
import { GuidedTroubleshooter } from "@/components/assistant/guided-troubleshooter";
import type { GuideStep, TroubleItem } from "@/lib/assistant/troubleshooting";
import { cn } from "@/lib/utils";

const ARTICLE_SUGGESTIONS = [
  "Does this work on Windows 10?",
  "What do I check if a step fails?",
  "Summarize the key steps",
];

type View = "ask" | "troubleshoot";

export function AskArticlePanel({
  articleId,
  articleTitle,
  canDraft,
  steps,
  troubleshooting,
}: {
  articleId: string;
  articleTitle: string;
  canDraft: boolean;
  steps: GuideStep[];
  troubleshooting: TroubleItem[];
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("ask");
  const [input, setInput] = useState("");
  const { turns, busy, ask } = useAssistantThread({ scope: "article", articleId });
  const endRef = useRef<HTMLDivElement>(null);
  const canTroubleshoot = steps.length > 0;

  // The `a` shortcut (on an article page) opens the panel.
  useEffect(() => {
    function onAsk() {
      setOpen(true);
    }
    window.addEventListener(ASK_ARTICLE_EVENT, onAsk);
    return () => window.removeEventListener(ASK_ARTICLE_EVENT, onAsk);
  }, []);

  useEffect(() => {
    if (open && view === "ask") endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, open, view]);

  const send = (question: string, mode: "answer" | "eli5" = "answer") => {
    setInput("");
    void ask(question, mode);
  };

  const askAboutStep = (step: GuideStep) => {
    setView("ask");
    send(`Step ${step.stepNumber} ("${step.title}") isn't working. What should I check?`);
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

          {canTroubleshoot ? (
            <div className="flex gap-1 border-b border-border px-4 py-2">
              <ModeTab active={view === "ask"} onClick={() => setView("ask")}>
                Ask
              </ModeTab>
              <ModeTab active={view === "troubleshoot"} onClick={() => setView("troubleshoot")}>
                Troubleshoot
              </ModeTab>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {view === "troubleshoot" ? (
              <GuidedTroubleshooter
                steps={steps}
                troubleshooting={troubleshooting}
                onAskAboutStep={askAboutStep}
              />
            ) : turns.length === 0 ? (
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

          {view === "ask" ? (
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
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-lg px-3 py-1 text-[13px] font-medium transition",
        active ? "bg-accent-soft text-accent" : "text-fg-muted hover:bg-surface-muted",
      )}
    >
      {children}
    </button>
  );
}
