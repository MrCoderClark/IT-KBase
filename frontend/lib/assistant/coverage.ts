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

export const MAX_CLUSTERS = 10;
const MAX_CLUSTER_QUESTIONS = 8;

/** The model's clustering: a label + theme plus the member gap ids it assigned. */
export interface RawGapCluster {
  label: string;
  theme: string;
  /** Ids referencing gaps by their index (as strings) in the `gaps` array. */
  gapIds: string[];
}

export interface GapCluster {
  label: string;
  theme: string;
  /** Summed demand across the cluster's gaps. */
  askCount: number;
  /** Number of gaps in the cluster. */
  gapCount: number;
  /** A few sample questions, for display. */
  questions: string[];
  /** ISO timestamp of the most recent ask across the cluster. */
  lastAskedAt: string;
}

/**
 * Enrich the model's clustering with deterministic demand. Each gap id is a gap's
 * index in `gaps`; a gap counts toward the first cluster that claims it (so demand
 * is never double-counted), clusters are ranked by demand, and the arithmetic
 * stays here — the model only groups questions, it never sums. Out-of-range or
 * repeated ids are ignored, and empty clusters are dropped.
 */
export function buildGapClusters(gaps: GapRow[], clusters: RawGapCluster[]): GapCluster[] {
  const claimed = new Set<number>();
  const built: GapCluster[] = [];
  for (const cluster of clusters) {
    let askCount = 0;
    let gapCount = 0;
    let lastAskedAt = "";
    const questions: string[] = [];
    for (const id of cluster.gapIds) {
      const index = Number(id);
      if (!Number.isInteger(index) || index < 0 || index >= gaps.length) continue;
      if (claimed.has(index)) continue;
      claimed.add(index);
      const gap = gaps[index];
      gapCount += 1;
      askCount += gap.askCount;
      if (gap.lastAskedAt > lastAskedAt) lastAskedAt = gap.lastAskedAt;
      if (questions.length < MAX_CLUSTER_QUESTIONS) questions.push(gap.sampleQuestion);
    }
    if (gapCount === 0) continue;
    built.push({ label: cluster.label, theme: cluster.theme, askCount, gapCount, questions, lastAskedAt });
  }
  built.sort((a, b) => b.askCount - a.askCount || b.gapCount - a.gapCount);
  return built.slice(0, MAX_CLUSTERS);
}
