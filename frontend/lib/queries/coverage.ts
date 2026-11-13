/**
 * Coverage report query (spec 20 §3.3 C5) — open knowledge gaps ranked by
 * demand. Server Components only; reviewer+ gating is enforced by the Analytics
 * page that calls it, like the other analytics queries. No model call.
 */

import { prisma } from "@/lib/db";
import type { GapRow } from "@/lib/assistant/coverage";

export async function getCoverageGaps(limit = 50): Promise<GapRow[]> {
  const rows = await prisma.knowledgeGap.findMany({
    where: { status: "open" },
    orderBy: [{ askCount: "desc" }, { lastAskedAt: "desc" }],
    take: limit,
    select: { normalized: true, sampleQuestion: true, askCount: true, lastAskedAt: true },
  });
  return rows.map((row) => ({
    normalized: row.normalized,
    sampleQuestion: row.sampleQuestion,
    askCount: row.askCount,
    lastAskedAt: row.lastAskedAt.toISOString(),
  }));
}
