import { listableStatuses } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { parseArticleFacets } from "@/lib/kb/article-filters";
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
  const filters = parseArticleFacets(
    {
      category: url.searchParams.get("category"),
      status: url.searchParams.get("status"),
      updated: url.searchParams.get("updated"),
    },
    listableStatuses(session.role),
  );
  const hits = await searchArticles(query, limit, session.role, session.userId, filters);
  return Response.json({ hits });
}
