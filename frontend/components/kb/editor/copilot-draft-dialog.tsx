"use client";

/**
 * Authoring copilot — draft from a prompt (B1, generative) or from pasted notes
 * (B2, grounded), spec 20 §3.2. Returns a ParsedDraft; the editor maps it with
 * parsedToDraft and the author reviews before saving. The model never writes the
 * DB. Prompt mode grounds the existing category/tags and marks unknowns as TODO.
 */

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ParsedDraft } from "@/lib/ingestion/to-draft";

const MAX_NOTES = 16_000;
const MAX_PROMPT = 2_000;

type Mode = "prompt" | "notes";

export function CopilotDraftDialog({
  open,
  hasContent,
  categoryName,
  tagNames,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  /** True when the editor already holds content, so applying replaces it. */
  hasContent: boolean;
  categoryName: string | null;
  tagNames: string[];
  onOpenChange: (open: boolean) => void;
  onApply: (draft: ParsedDraft) => void;
}) {
  const [mode, setMode] = useState<Mode>("prompt");
  const [prompt, setPrompt] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = mode === "prompt" ? prompt : notes;

  function close(next: boolean) {
    if (busy) return;
    if (!next) setError(null);
    onOpenChange(next);
  }

  async function generate() {
    if (!value.trim()) {
      setError(mode === "prompt" ? "Describe the article to draft." : "Paste some notes to draft from.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/assistant/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          prompt: mode === "prompt" ? prompt.trim() : "",
          notes: mode === "notes" ? notes.trim() : "",
          categories: categoryName ? [categoryName] : [],
          tags: tagNames,
        }),
      });
      const data = (await response.json()) as { draft?: ParsedDraft; error?: string };
      if (!response.ok || !data.draft) {
        setError(data.error ?? "The assistant could not produce a draft.");
        return;
      }
      onApply(data.draft);
      setPrompt("");
      setNotes("");
      onOpenChange(false);
    } catch {
      setError("The assistant is unreachable. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={16} className="text-accent" aria-hidden />
            Draft with Copilot
          </DialogTitle>
          <DialogDescription>
            Generate a structured draft in the canonical sections for you to review — nothing is
            saved until you do.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 rounded-lg border border-border bg-canvas p-1">
          <ModeTab active={mode === "prompt"} onClick={() => setMode("prompt")} disabled={busy}>
            From a prompt
          </ModeTab>
          <ModeTab active={mode === "notes"} onClick={() => setMode("notes")} disabled={busy}>
            From notes
          </ModeTab>
        </div>

        {mode === "prompt" ? (
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-fg-muted">
              Describe the article
            </span>
            <textarea
              value={prompt}
              maxLength={MAX_PROMPT}
              onChange={(event) => setPrompt(event.target.value)}
              rows={4}
              disabled={busy}
              className={fieldClass}
              placeholder="e.g. Write a runbook for rotating the Entra ID app secret used by ServiceNow."
            />
            <span className="mt-1 block text-[11px] text-fg-subtle">
              Uses standard IT practice{categoryName || tagNames.length > 0 ? " and your category/tags" : ""};
              environment-specific values are marked TODO for you to fill.
            </span>
          </label>
        ) : (
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-fg-muted">Notes</span>
            <textarea
              value={notes}
              maxLength={MAX_NOTES}
              onChange={(event) => setNotes(event.target.value)}
              rows={10}
              disabled={busy}
              className={fieldClass}
              placeholder="Paste resolved-ticket text, chat notes, or a transcript…"
            />
            <span className="mt-1 block text-[11px] text-fg-subtle tabular-nums">
              {notes.length.toLocaleString()} / {MAX_NOTES.toLocaleString()}
            </span>
          </label>
        )}

        {hasContent ? (
          <p className="rounded-lg border border-warning/40 bg-warning-soft px-2.5 py-2 text-[12px] leading-4 text-warning-fg">
            This replaces the current editor content. Save first if you want to keep it.
          </p>
        ) : null}

        {error ? (
          <p className="text-[12px] font-medium text-warning" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => close(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={busy || !value.trim()} onClick={generate}>
            {busy ? (
              <>
                <Loader2 size={14} className="animate-spin" aria-hidden />
                Drafting…
              </>
            ) : (
              "Draft"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const fieldClass =
  "w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-[13px] leading-5 text-fg focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30";

function ModeTab({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "flex-1 rounded-md px-3 py-1 text-[13px] font-medium transition",
        active ? "bg-surface text-fg shadow-sm" : "text-fg-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
