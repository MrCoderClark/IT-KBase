import { getSession } from "@/lib/auth/session";
import { getConversation, softDeleteConversation } from "@/lib/assistant/conversations";

/** GET /api/assistant/conversations/:id — one own conversation with its turns. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return new Response("Sign in to continue.", { status: 401 });

  const { id } = await context.params;
  const conversation = await getConversation(session.userId, id);
  if (!conversation) return new Response("Conversation not found.", { status: 404 });
  return Response.json(conversation);
}

/** DELETE /api/assistant/conversations/:id — soft delete, own only. */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return new Response("Sign in to continue.", { status: 401 });

  const { id } = await context.params;
  const deleted = await softDeleteConversation(session.userId, id);
  if (!deleted) return new Response("Conversation not found.", { status: 404 });
  return new Response(null, { status: 204 });
}
