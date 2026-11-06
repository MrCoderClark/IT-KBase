/**
 * Streams the FastAPI answerer (`POST /assistant/answer`, spec 20 §7.2) from the
 * BFF. The bundle is the permission-filtered chunks; FastAPI may use only those.
 * Authenticated with the caller's user assertion.
 */

import { context } from "@opentelemetry/api";
import { injectTraceHeaders } from "@/lib/otel/ingest";

export type AnswerBundleChunk = {
  n: number;
  chunkId: string;
  kind: "prose" | "code";
  sectionTitle: string;
  text: string;
};

export type AnswerTurn = { role: "user" | "assistant"; content: string };
export type AnswerMode = "answer" | "eli5" | "command";

export type AnswerStreamEvent =
  | { type: "token"; data: { text: string } }
  | {
      type: "done";
      data: { answer: string; citations: number[]; grounded: boolean; usage: Record<string, number> };
    }
  | { type: "failed"; data: { code: string; message: string } };

export async function* streamAnswer(args: {
  question: string;
  bundle: AnswerBundleChunk[];
  history: AnswerTurn[];
  mode: AnswerMode;
  assertion: string;
}): AsyncGenerator<AnswerStreamEvent> {
  const base = (process.env.INGESTION_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
  const headers = injectTraceHeaders(
    {
      Authorization: `Bearer ${args.assertion}`,
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    },
    context.active(),
  );

  let response: Response;
  try {
    response = await fetch(`${base}/assistant/answer`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        question: args.question,
        bundle: args.bundle,
        history: args.history,
        mode: args.mode,
      }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch {
    yield { type: "failed", data: { code: "upstream", message: "The assistant is not running (start backend/ on port 8080)." } };
    return;
  }

  if (!response.ok || !response.body) {
    const message = response.status === 503 ? "The AI Assistant is not configured." : "The assistant could not answer.";
    yield { type: "failed", data: { code: "upstream", message } };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      const parsed = parseSse(block);
      if (parsed) yield parsed as AnswerStreamEvent;
    }
  }
}

function parseSse(block: string): { type: string; data: unknown } | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  try {
    return { type: event, data: JSON.parse(dataLines.join("\n")) };
  } catch {
    return null;
  }
}
