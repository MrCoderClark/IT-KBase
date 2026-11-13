/**
 * Coverage report (spec 20 §3.3 C5), deterministic core. Pure helpers over the
 * open KnowledgeGap rows — the ones logged when the assistant can't answer from
 * the KB (A7). Ranking by demand is a DB order; these compute the headline
 * stats and the "active this month" signal. No model call.
 *
 * LLM theme-clustering ("14 people asked about MFA re-registration") is a later
 * slice; this one ranks and counts.
 */

export const ACTIVE_WINDOW_DAYS = 30;

export interface GapRow {
  normalized: string;
  sampleQuestion: string;
  askCount: number;
  /** ISO timestamp of the most recent ask. */
  lastAskedAt: string;
}

export function withinDays(lastAskedAt: string, now: Date, days: number): boolean {
  const asked = new Date(lastAskedAt).getTime();
  if (Number.isNaN(asked)) return false;
  return now.getTime() - asked <= days * 86_400_000;
}

export interface CoverageStats {
  /** Number of distinct open gaps. */
  openCount: number;
  /** Total asks across them (demand). */
  totalAsks: number;
  /** Gaps asked within the last 30 days. */
  activeThisMonth: number;
}

export function coverageStats(gaps: GapRow[], now: Date): CoverageStats {
  let totalAsks = 0;
  let activeThisMonth = 0;
  for (const gap of gaps) {
    totalAsks += gap.askCount;
    if (withinDays(gap.lastAskedAt, now, ACTIVE_WINDOW_DAYS)) activeThisMonth += 1;
  }
  return { openCount: gaps.length, totalAsks, activeThisMonth };
}
