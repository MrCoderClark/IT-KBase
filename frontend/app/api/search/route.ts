import { getSession } from "@/lib/auth/session";
import { searchQuery } from "@/lib/kb/search";
import { searchArticles } from "@/lib/queries/search";

export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ hits: [] }, { status: 401 });

  const url = new URL(request.url);
  const query = searchQuery(url.searchParams.get("q") ?? "");
  if (!query) return Response.json({ hits: [] });

  const requested = Number(url.searchParams.get("limit") ?? 8);
  const limit = Number.isFinite(requested) ? Math.min(20, Math.max(1, Math.floor(requested))) : 8;
  const hits = await searchArticles(query, limit, session.role, session.userId);
  return Response.json({ hits });
}
