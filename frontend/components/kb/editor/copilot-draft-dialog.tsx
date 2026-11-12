"use client";

/**
 * Authoring copilot — "Draft from notes" (spec 20 §3.2 B2). Paste resolved-ticket
 * text, Teams notes, or a transcript and get a structured ParsedDraft back; the
 * editor maps it with parsedToDraft and the author reviews before saving. The
 * generative "from a prompt" mode (B1) will join this dialog in a follow-up.
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
import type { ParsedDraft } from "@/lib/ingestion/to-draft";

const MAX_NOTES = 16_000;

export function CopilotDraftDialog({
  open,
  hasContent,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  /** True when the editor already holds content, so applying replaces it. */
  hasContent: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (draft: ParsedDraft) => void;
}) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close(next: boolean) {
    if (busy) return;
    if (!next) {
      setError(null);
    }
    onOpenChange(next);
  }

  async function generate() {
    const trimmed = notes.trim();
    if (!trimmed) {
      setError("Paste some notes to draft from.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/assistant/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: trimmed, mode: "notes" }),
      });
      const data = (await response.json()) as { draft?: ParsedDraft; error?: string };
      if (!response.ok || !data.draft) {
        setError(data.error ?? "The assistant could not produce a draft.");
        return;
      }
      onApply(data.draft);
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
            Draft from notes
          </DialogTitle>
          <DialogDescription>
            Paste resolved-ticket text, chat notes, or a transcript. The copilot structures it into
            the canonical sections for you to review — nothing is saved until you do.
          </DialogDescription>
        </DialogHeader>

        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-fg-muted">Notes</span>
          <textarea
            value={notes}
            maxLength={MAX_NOTES}
            onChange={(event) => setNotes(event.target.value)}
            rows={10}
            disabled={busy}
            className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-[13px] leading-5 text-fg focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
            placeholder="e.g. Ticket INC-4821: user locked out after password rotation. Steps I took: 1) booted into WinRE, 2) ran net user…"
          />
          <span className="mt-1 block text-[11px] text-fg-subtle tabular-nums">
            {notes.length.toLocaleString()} / {MAX_NOTES.toLocaleString()}
          </span>
        </label>

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
          <Button type="button" disabled={busy || !notes.trim()} onClick={generate}>
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
