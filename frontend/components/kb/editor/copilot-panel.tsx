"use client";

/**
 * Editor Copilot checks (spec 20 §3.2 B4, B6). A read-only rail panel that runs
 * the deterministic missing-section and risky-command checks against the live
 * draft. Suggestions only — the author decides what to change.
 */

import { useMemo } from "react";
import { AlertTriangle, ListChecks, Sparkles } from "lucide-react";
import type { EditorDraft } from "@/lib/editor/draft";
import { missingSections, riskyCommands } from "@/lib/assistant/copilot-checks";
import { cn } from "@/lib/utils";

export function CopilotPanel({ draft }: { draft: EditorDraft }) {
  const missing = useMemo(() => missingSections(draft), [draft]);
  const risky = useMemo(() => riskyCommands(draft), [draft]);
  const clear = missing.length === 0 && risky.length === 0;

  return (
    <section aria-label="Copilot checks" className="space-y-3 border-t border-border pt-4">
      <h2 className="flex items-center gap-1.5 text-[12px] font-semibold text-fg-muted">
        <Sparkles size={13} className="text-accent" aria-hidden />
        Copilot checks
      </h2>

      {clear ? (
        <p className="rounded-lg border border-success/30 bg-success-soft px-2.5 py-2 text-[12px] leading-4 text-success-fg">
          All canonical sections are filled and no risky commands found.
        </p>
      ) : (
        <>
          {missing.length > 0 ? (
            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 text-[12px] font-medium text-fg">
                <ListChecks size={13} aria-hidden />
                Missing sections
              </p>
              <ul className="space-y-1.5">
                {missing.map((item) => (
                  <li
                    key={item.kind}
                    className="rounded-lg border border-border bg-canvas px-2.5 py-1.5 text-[12px] leading-4 text-fg-muted"
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "font-semibold",
                          item.priority === "important" ? "text-fg" : "text-fg-muted",
                        )}
                      >
                        {item.title}
                      </span>
                      {item.priority === "important" ? (
                        <span className="rounded-xs bg-warning-soft px-1 text-[10px] font-semibold uppercase tracking-wide text-warning-fg">
                          needed
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block">{item.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {risky.length > 0 ? (
            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 text-[12px] font-medium text-warning-fg">
                <AlertTriangle size={13} aria-hidden />
                Risky commands
              </p>
              <ul className="space-y-1.5">
                {risky.map((match) => (
                  <li
                    key={match.id}
                    className="rounded-lg border border-warning/40 bg-warning-soft px-2.5 py-1.5 text-[12px] leading-4"
                  >
                    <span className="font-semibold text-fg">{match.where}</span>
                    <code className="mt-0.5 block truncate font-mono text-[11px] text-fg-muted">
                      {match.line}
                    </code>
                    <span className="mt-1 block text-fg-muted">{match.advice}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
