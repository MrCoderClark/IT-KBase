/**
 * Publish pre-check (spec 20 §3.3 C2). A single pass/fail verdict over a draft,
 * composing the hard publish gates (`publishChecks` — title, category, tag,
 * summary, ≥ 1 step) with the B4 missing-section and B6 risky-command checks.
 *
 * The required gates alone decide `ok` and the Publish button — behaviour is
 * unchanged from before. B4/B6 are advisory (the spec calls B4 "suggestions
 * only"): they surface as warnings with reasons, but never block publish.
 *
 * Pure — no model call, no backend.
 */

import { publishChecks, type EditorDraft, type PublishCheck } from "@/lib/editor/draft";
import { missingSections, riskyCommands } from "@/lib/assistant/copilot-checks";

export interface PreCheckWarning {
  /** Stable key for rendering. */
  id: string;
  kind: "missing-section" | "risky-command";
  /** Short label, e.g. "Verification" or "rm -rf". */
  label: string;
  /** Why it matters / what to do. */
  reason: string;
  /** "important" sorts first and reads louder; "advisory" rounds out the draft. */
  severity: "important" | "advisory";
}

export interface PublishPreCheck {
  /** The hard gates. Every one must pass before publish is allowed. */
  required: PublishCheck[];
  /** Non-blocking suggestions (B4 + B6), important first. */
  warnings: PreCheckWarning[];
  /** True when every required gate passes — this alone gates the Publish button. */
  ok: boolean;
}

export function publishPreCheck(draft: EditorDraft): PublishPreCheck {
  const required = publishChecks(draft);

  const warnings: PreCheckWarning[] = [];

  // B4 — missing sections. The empty-steps case is already covered by the
  // required "At least one step" gate, so drop it here to avoid double-reporting.
  for (const suggestion of missingSections(draft)) {
    if (suggestion.kind === "steps") continue;
    warnings.push({
      id: `section:${suggestion.kind}`,
      kind: "missing-section",
      label: suggestion.title,
      reason: suggestion.message,
      severity: suggestion.priority === "important" ? "important" : "advisory",
    });
  }

  // B6 — destructive commands. Safety flags, so they read as important.
  for (const match of riskyCommands(draft)) {
    warnings.push({
      id: `risky:${match.id}`,
      kind: "risky-command",
      label: match.label,
      reason: `${match.where}: ${match.advice}`,
      severity: "important",
    });
  }

  // Important warnings first, otherwise insertion order (sections then commands).
  warnings.sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "important" ? -1 : 1,
  );

  return { required, warnings, ok: required.every((check) => check.ok) };
}
