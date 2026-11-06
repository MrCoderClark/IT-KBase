/**
 * Knowledge-gap logging (spec 20 §3.1 A7, §6.2). An ungrounded question is
 * logged under a normalized key so repeated asks raise `askCount` and cluster
 * in the coverage report, instead of creating duplicate rows.
 */

import { prisma } from "@/lib/db";

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "do", "does", "did", "how", "what", "why", "when",
  "where", "who", "can", "i", "my", "to", "of", "in", "on", "for", "and", "or", "with",
  "it", "this", "that", "me", "you", "we", "if", "after", "before", "from", "at", "by",
]);

/** Lowercased, de-punctuated, stop-worded key — stable across phrasings. */
export function normalizeQuestion(question: string): string {
  const words = question
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word));
  return words.join(" ").slice(0, 300);
}

/** Record an unanswered question. No-op for a blank normalized key. */
export async function logKnowledgeGap(question: string): Promise<void> {
  const normalized = normalizeQuestion(question);
  if (!normalized) return;
  const sampleQuestion = question.trim().slice(0, 500);
  try {
    await prisma.knowledgeGap.upsert({
      where: { normalized },
      create: { normalized, sampleQuestion },
      update: { askCount: { increment: 1 }, lastAskedAt: new Date() },
    });
  } catch (err) {
    // Gap logging is best-effort; never fail the answer over it.
    console.warn(
      JSON.stringify({
        event: "assistant.gap.failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}
