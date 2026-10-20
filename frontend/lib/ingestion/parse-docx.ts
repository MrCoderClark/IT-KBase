import { mintIngestionAssertion } from "@/lib/auth/assertion";
import type { AppSession } from "@/lib/auth/session";
import type { EditorDraft } from "@/lib/editor/draft";
import { parsedToDraft, type ParsedDraft } from "@/lib/ingestion/to-draft";

const MAX_BYTES = 25 * 1024 * 1024;

export async function draftFromDocx(
  session: AppSession,
  filename: string,
  bytes: Uint8Array,
): Promise<{ ok: true; draft: EditorDraft } | { ok: false; error: string }> {
  if (bytes.byteLength > MAX_BYTES) {
    return { ok: false, error: "That file is larger than 25 MB." };
  }

  const assertion = await mintIngestionAssertion(session, new Date());
  if (!assertion) {
    return {
      ok: false,
      error: "Ingestion is not configured. AUTH_ASSERTION_KEYS has to match the Python service.",
    };
  }

  const base = (process.env.INGESTION_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
  const body = new FormData();
  body.append(
    "file",
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    filename,
  );

  let response: Response;
  try {
    response = await fetch(`${base}/v1/parse/docx`, {
      method: "POST",
      headers: { Authorization: `Bearer ${assertion}` },
      body,
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    return {
      ok: false,
      error: "The ingestion service is not running. Start it from backend/ on port 8080.",
    };
  }

  if (!response.ok) {
    return { ok: false, error: await errorMessage(response) };
  }

  const parsed = (await response.json()) as ParsedDraft;
  if (!parsed.title?.trim()) {
    return { ok: false, error: "That document has no text to import." };
  }
  return { ok: true, draft: parsedToDraft(parsed) };
}

async function errorMessage(response: Response): Promise<string> {
  if (response.status === 401) {
    return "The ingestion service rejected the sign-in. Check that the assertion keys match.";
  }
  const payload = (await response.json().catch(() => null)) as { detail?: unknown } | null;
  if (typeof payload?.detail === "string" && payload.detail) return payload.detail;
  return "The document could not be read.";
}
