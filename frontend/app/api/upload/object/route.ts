import { mintIngestionAssertion } from "@/lib/auth/assertion";
import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { keyOwnedBy, withinUploadLimit } from "@/lib/ingestion/object-key";
import { forbidBadOrigin } from "@/lib/security/request-origin";

export const maxDuration = 120;

const OBJECT_KEY_HEADER = "x-tb-object-key";

/**
 * Same-origin upload proxy. The browser PUTs here; Next forwards bytes to
 * FastAPI → SeaweedFS. Avoids brittle browser→S3 CORS / localhost vs 127.0.0.1.
 */
export async function PUT(request: Request): Promise<Response> {
  const blocked = forbidBadOrigin(request);
  if (blocked) return blocked;
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  if (!can(session.role, "article.create")) {
    return Response.json({ error: "You cannot import articles." }, { status: 403 });
  }

  const key = request.headers.get(OBJECT_KEY_HEADER)?.trim() ?? "";
  if (!keyOwnedBy(session.userId, key)) {
    return Response.json({ error: "That file is not in storage." }, { status: 422 });
  }

  const sizeHeader = request.headers.get("content-length");
  const sizeBytes = sizeHeader ? Number(sizeHeader) : 0;
  if (sizeHeader && !withinUploadLimit(sizeBytes)) {
    return Response.json({ error: "That file is larger than 25 MB." }, { status: 413 });
  }

  const assertion = await mintIngestionAssertion(session, new Date());
  if (!assertion) {
    return Response.json(
      { error: "Ingestion is not configured. AUTH_ASSERTION_KEYS has to match the Python service." },
      { status: 503 },
    );
  }

  const contentType = request.headers.get("content-type") || "application/octet-stream";
  const base = (process.env.INGESTION_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");

  let upstream: Response;
  try {
    upstream = await fetch(`${base}/v1/uploads/object`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${assertion}`,
        "Content-Type": contentType,
        [OBJECT_KEY_HEADER]: key,
      },
      body: request.body,
      // Node fetch: stream the incoming body through without buffering twice.
      duplex: "half",
    } as RequestInit);
  } catch {
    return Response.json(
      { error: "The ingestion service is not running. Start it from backend/ on port 8080." },
      { status: 503 },
    );
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    let message = "The file could not be stored.";
    try {
      const parsed = JSON.parse(detail) as { detail?: string; error?: string };
      message = parsed.detail ?? parsed.error ?? message;
    } catch {
      if (detail.trim()) message = detail.trim().slice(0, 200);
    }
    return Response.json({ error: message }, { status: upstream.status });
  }

  return new Response(null, { status: 204 });
}
