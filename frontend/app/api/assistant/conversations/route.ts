import { getSession } from "@/lib/auth/session";
import { listConversations } from "@/lib/assistant/conversations";

/** GET /api/assistant/conversations — own conversations, cursor-paginated (spec 20 §7.1). */
export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return new Response("Sign in to continue.", { status: 401 });

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limitRaw = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;

  const page = await listConversations(session.userId, { cursor, limit });
  return Response.json(page);
}
