import { can } from "@/lib/auth/policy";
import { getSession } from "@/lib/auth/session";
import { presignUpload } from "@/lib/ingestion/parse-docx";
import { safeFileName, sourceKindOf, withinUploadLimit } from "@/lib/ingestion/object-key";

export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in to continue." }, { status: 401 });
  if (!can(session.role, "article.create")) {
    return Response.json({ error: "Your role can read articles. An author, reviewer, or admin can import one." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    fileName?: unknown;
    contentType?: unknown;
    sizeBytes?: unknown;
  } | null;
  const fileName = typeof body?.fileName === "string" ? safeFileName(body.fileName) : "";
  const sizeBytes = typeof body?.sizeBytes === "number" ? body.sizeBytes : 0;
  if (!sourceKindOf(fileName)) {
    return Response.json({ error: "Only a .docx or .pdf file can be imported." }, { status: 415 });
  }
  if (!withinUploadLimit(sizeBytes)) {
    return Response.json({ error: "That file is larger than 25 MB." }, { status: 413 });
  }

  const signed = await presignUpload(session, {
    fileName,
    contentType: typeof body?.contentType === "string" ? body.contentType : "application/octet-stream",
    sizeBytes,
  });
  if (!signed.ok) return Response.json({ error: signed.error }, { status: 503 });

  return Response.json({
    key: signed.key,
    url: signed.url,
    headers: signed.headers,
    maxBytes: 25 * 1024 * 1024,
  });
}
