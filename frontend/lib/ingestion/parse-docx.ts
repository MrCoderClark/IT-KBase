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
  const pdf = filename.toLowerCase().endsWith(".pdf");
  const body = new FormData();
  body.append(
    "file",
    new Blob([Uint8Array.from(bytes)], {
      type: pdf
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    filename,
  );

  let response: Response;
  try {
    response = await fetch(`${base}${pdf ? "/v1/parse/pdf" : "/v1/parse/docx"}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${assertion}` },
      body,
      signal: AbortSignal.timeout(180_000),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return {
      ok: false,
      error: timedOut
        ? "Reading that file took too long. Start the import again."
        : "The ingestion service is not running. Start it from backend/ on port 8080.",
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

export async function draftFromStored(
  session: AppSession,
  body: {
    jobId: string;
    s3Key: string;
    fileName: string;
    sourceKind: "docx" | "pdf";
    sizeBytes: number;
  },
): Promise<{ ok: true; draft: EditorDraft } | { ok: false; error: string }> {
  const assertion = await mintIngestionAssertion(session, new Date());
  if (!assertion) {
    return {
      ok: false,
      error: "Ingestion is not configured. AUTH_ASSERTION_KEYS has to match the Python service.",
    };
  }

  const base = (process.env.INGESTION_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
  let response: Response;
  try {
    response = await fetch(`${base}/ingest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${assertion}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180_000),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return {
      ok: false,
      error: timedOut
        ? "Reading that file took too long. Start the import again."
        : "The ingestion service is not running. Start it from backend/ on port 8080.",
    };
  }

  if (!response.ok) {
    return { ok: false, error: await errorMessage(response) };
  }

  const payload = (await response.json()) as { draft?: ParsedDraft };
  if (!payload.draft?.title?.trim()) {
    return { ok: false, error: "That document has no text to import." };
  }
  return { ok: true, draft: parsedToDraft(payload.draft) };
}

export async function presignUpload(
  session: AppSession,
  body: { fileName: string; contentType: string; sizeBytes: number },
): Promise<
  | { ok: true; key: string; url: string; headers: Record<string, string> }
  | { ok: false; error: string }
> {
  const assertion = await mintIngestionAssertion(session, new Date());
  if (!assertion) {
    return {
      ok: false,
      error: "Ingestion is not configured. AUTH_ASSERTION_KEYS has to match the Python service.",
    };
  }

  const base = (process.env.INGESTION_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
  let response: Response;
  try {
    response = await fetch(`${base}/v1/uploads/presign`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${assertion}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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

  const payload = (await response.json()) as {
    key?: string;
    url?: string;
    headers?: Record<string, string>;
  };
  if (!payload.key || !payload.url || !payload.headers) {
    return { ok: false, error: "Object storage did not return an upload URL." };
  }
  return { ok: true, key: payload.key, url: payload.url, headers: payload.headers };
}

async function errorMessage(response: Response): Promise<string> {
  if (response.status === 401) {
    return "The ingestion service rejected the sign-in. Check that the assertion keys match.";
  }
  if (response.status === 404) {
    return "The ingestion service is missing the upload route. Restart it from backend/.";
  }
  const payload = (await response.json().catch(() => null)) as { detail?: unknown } | null;
  if (typeof payload?.detail === "string" && payload.detail) return payload.detail;
  return "The document could not be read.";
}
