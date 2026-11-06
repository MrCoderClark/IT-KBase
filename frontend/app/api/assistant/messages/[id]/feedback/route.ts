import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

type Body = { helpful?: boolean };

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return new Response("Sign in to continue.", { status: 401 });

  const { id } = await context.params;
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return new Response("Invalid request body.", { status: 400 });
  }
  if (typeof body.helpful !== "boolean") {
    return new Response("helpful is required.", { status: 400 });
  }

  // Own messages only: join through the conversation's userId.
  const message = await prisma.assistantMessage.findUnique({
    where: { id },
    select: { id: true, role: true, conversation: { select: { userId: true } } },
  });
  if (!message || message.conversation.userId !== session.userId || message.role !== "assistant") {
    return new Response("Message not found.", { status: 404 });
  }

  await prisma.assistantMessage.update({ where: { id }, data: { helpful: body.helpful } });
  return Response.json({ ok: true });
}
