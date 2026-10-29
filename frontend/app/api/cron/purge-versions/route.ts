import { NextResponse } from "next/server";
import { purgeExpiredVersions } from "@/lib/versions/purge-expired";

/**
 * Daily retention job. Vercel Cron sends Authorization: Bearer $CRON_SECRET.
 * Local: set CRON_SECRET and call with the same header.
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

  const result = await purgeExpiredVersions();
  return NextResponse.json({
    ok: true,
    retentionDays: result.retentionDays,
    cutoff: result.cutoff.toISOString(),
    deleted: result.deleted,
  });
}
