import { NextResponse } from "next/server";
import { purgeExpiredConversations } from "@/lib/assistant/purge-conversations";

/**
 * Daily AI Assistant conversation retention job. Same auth model as
 * /api/cron/purge-versions: Vercel Cron sends Authorization: Bearer
 * $CRON_SECRET; local callers send the same header.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }

  const header = request.headers.get("authorization");
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await purgeExpiredConversations();
  return NextResponse.json({
    ok: true,
    retentionDays: result.retentionDays,
    cutoff: result.cutoff.toISOString(),
    deleted: result.deleted,
  });
}
