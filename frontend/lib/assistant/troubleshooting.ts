/**
 * Guided troubleshooting (spec 20 §3 A6): turn an article's Steps into a
 * checklist and, when a step fails, surface the matching Troubleshooting
 * callout. Pure and deterministic — no LLM — so it stays fast and testable.
 */

import type { CalloutVariant } from "@/lib/types/article";

export type GuideStep = { stepNumber: number; title: string; content: string };
export type TroubleItem = { id: string; variant: CalloutVariant; title: string; content: string };

/** Drop tags and collapse whitespace from an article HTML fragment. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Common words carry no matching signal; drop them before scoring overlap.
const STOP = new Set([
  "the", "and", "for", "with", "that", "this", "your", "you", "from", "into",
  "when", "then", "will", "have", "has", "are", "was", "not", "can", "use",
  "using", "click", "select", "open", "run", "type", "press", "enter", "step",
  "windows", "device", "computer", "system", "settings", "following", "under",
]);

/** Significant lowercase tokens (len > 3, non-stopword) from HTML or text. */
export function keywords(text: string): Set<string> {
  const words = stripHtml(text).toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const out = new Set<string>();
  for (const w of words) {
    if (w.length > 3 && !STOP.has(w)) out.add(w);
  }
  return out;
}

/**
 * Troubleshooting callouts that share keywords with a failed step, most
 * relevant first. Empty when nothing overlaps — the caller then offers the
 * fall-backs (all callouts, or asking the assistant about the step).
 */
export function matchTroubleshooting(step: GuideStep, items: TroubleItem[]): TroubleItem[] {
  const stepKw = keywords(`${step.title} ${step.content}`);
  if (stepKw.size === 0) return [];
  const scored: { item: TroubleItem; score: number }[] = [];
  for (const item of items) {
    const itemKw = keywords(`${item.title} ${item.content}`);
    let score = 0;
    for (const w of itemKw) if (stepKw.has(w)) score += 1;
    if (score > 0) scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
}
