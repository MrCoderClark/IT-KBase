/**
 * Orchestrates one assistant answer (spec 20 §5). Retrieves and permission-
 * filters chunks (BFF), skips the LLM when nothing is grounded (§5.2 step 7),
 * streams the model otherwise, persists the turn with its citations, and logs a
 * KnowledgeGap when the KB can't answer. Yields the SSE events the route
 * forwards to the browser (§7.1).
 */

import { trace } from "@opentelemetry/api";
import { Prisma } from "@prisma/client";
import { mintIngestionAssertion } from "@/lib/auth/assertion";
import type { AppSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  type AnswerBundleChunk,
  type AnswerMode,
  type AnswerTurn,
  streamAnswer,
} from "./answer-client";
import { capBundle, retrieveChunks, type RetrievedChunk } from "./retrieval";
import { logKnowledgeGap } from "./gaps";

const NOT_IN_KB = "I couldn't find an answer to this in the knowledge base.";

export type AskEvent =
  | { type: "retrieval"; data: { articles: number; chunks: number; grounded: boolean } }
  | {
      type: "citation";
      data: { n: number; slug: string; title: string; sectionAnchor: string; versionId: string };
    }
  | { type: "token"; data: { text: string } }
  | {
      type: "done";
      data: {
        messageId: string;
        conversationId: string;
        grounded: boolean;
        usage: Record<string, number>;
        traceId: string | null;
        nearest: { slug: string; title: string }[];
        citedN: number[]; // citation numbers the answer actually used
      };
    }
  | { type: "failed"; data: { code: string; message: string } };

export type AskInput = {
  session: AppSession;
  question: string;
  scope?: "library" | "article";
  articleId?: string;
  conversationId?: string;
  mode?: AnswerMode;
};

type Citation = {
  n: number;
  chunkId: string;
  articleId: string;
  slug: string;
  title: string;
  sectionAnchor: string;
  versionId: string;
};

export async function* askAssistant(input: AskInput): AsyncGenerator<AskEvent> {
  const started = Date.now();
  const traceId = trace.getActiveSpan()?.spanContext().traceId ?? null;
  const { session, question } = input;
  const scope = input.scope ?? "library";

  const retrieval = await retrieveChunks({
    question,
    session,
    articleId: scope === "article" ? input.articleId : undefined,
  });
  const bundle = capBundle(retrieval.chunks);
  const citations = bundle.map((chunk, i) => toCitation(chunk, i + 1));

  yield {
    type: "retrieval",
    data: {
      articles: new Set(bundle.map((c) => c.articleId)).size,
      chunks: bundle.length,
      grounded: retrieval.grounded,
    },
  };
  for (const citation of citations) {
    yield {
      type: "citation",
      data: {
        n: citation.n,
        slug: citation.slug,
        title: citation.title,
        sectionAnchor: citation.sectionAnchor,
        versionId: citation.versionId,
      },
    };
  }

  // Not in the KB: skip the LLM entirely, log the gap, record the turn.
  if (!retrieval.grounded) {
    await logKnowledgeGap(question);
    const { messageId, conversationId } = await persistTurn({
      input,
      answer: NOT_IN_KB,
      citations: [],
      grounded: false,
      usage: {},
      model: null,
      latencyMs: Date.now() - started,
      traceId,
    });
    yield {
      type: "done",
      data: {
        messageId,
        conversationId,
        grounded: false,
        usage: {},
        traceId,
        nearest: retrieval.nearest,
        citedN: [],
      },
    };
    return;
  }

  const assertion = await mintIngestionAssertion(session, new Date());
  if (!assertion) {
    yield { type: "failed", data: { code: "config", message: "The assistant is not configured." } };
    return;
  }

  const history = await loadHistory(input.conversationId, session.userId);
  const answerBundle: AnswerBundleChunk[] = bundle.map((chunk, i) => ({
    n: i + 1,
    chunkId: chunk.chunkId,
    kind: chunk.kind,
    sectionTitle: chunk.sectionTitle,
    text: chunk.text,
  }));

  let answer = "";
  let referenced: number[] = [];
  let usage: Record<string, number> = {};

  for await (const event of streamAnswer({
    question,
    bundle: answerBundle,
    history,
    mode: input.mode ?? "answer",
    assertion,
  })) {
    if (event.type === "token") {
      yield { type: "token", data: event.data };
    } else if (event.type === "failed") {
      yield { type: "failed", data: event.data };
      return;
    } else if (event.type === "done") {
      answer = event.data.answer;
      referenced = event.data.citations;
      usage = event.data.usage ?? {};
    }
  }

  const used = citations.filter((c) => referenced.includes(c.n));
  const { messageId, conversationId } = await persistTurn({
    input,
    answer,
    citations: used,
    grounded: true,
    usage,
    model: usage.model ? String(usage.model) : null,
    latencyMs: Date.now() - started,
    traceId,
  });

  yield {
    type: "done",
    data: {
      messageId,
      conversationId,
      grounded: true,
      usage,
      traceId,
      nearest: [],
      citedN: used.map((c) => c.n),
    },
  };
}

function toCitation(chunk: RetrievedChunk, n: number): Citation {
  return {
    n,
    chunkId: chunk.chunkId,
    articleId: chunk.articleId,
    slug: chunk.slug,
    title: chunk.articleTitle,
    sectionAnchor: slugifyAnchor(chunk.sectionTitle),
    versionId: chunk.versionId,
  };
}

function slugifyAnchor(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function loadHistory(
  conversationId: string | undefined,
  userId: string,
): Promise<AnswerTurn[]> {
  if (!conversationId) return [];
  const conversation = await prisma.assistantConversation.findFirst({
    where: { id: conversationId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!conversation) return [];
  const messages = await prisma.assistantMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 8,
    select: { role: true, content: true },
  });
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

async function persistTurn(args: {
  input: AskInput;
  answer: string;
  citations: Citation[];
  grounded: boolean;
  usage: Record<string, number>;
  model: string | null;
  latencyMs: number;
  traceId: string | null;
}): Promise<{ messageId: string; conversationId: string }> {
  const { input } = args;
  const conversationId = await ensureConversation(input);
  await prisma.assistantMessage.create({
    data: { conversationId, role: "user", content: input.question.slice(0, 4_000) },
  });
  const assistant = await prisma.assistantMessage.create({
    data: {
      conversationId,
      role: "assistant",
      content: args.answer,
      citations: args.citations as unknown as Prisma.InputJsonValue,
      grounded: args.grounded,
      model: args.model,
      tokensIn: args.usage.prompt_tokens ?? null,
      tokensOut: args.usage.completion_tokens ?? null,
      latencyMs: args.latencyMs,
      traceId: args.traceId,
    },
    select: { id: true },
  });
  await prisma.assistantConversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
  return { messageId: assistant.id, conversationId };
}

async function ensureConversation(input: AskInput): Promise<string> {
  if (input.conversationId) {
    const existing = await prisma.assistantConversation.findFirst({
      where: { id: input.conversationId, userId: input.session.userId, deletedAt: null },
      select: { id: true },
    });
    if (existing) return existing.id;
  }
  const conversation = await prisma.assistantConversation.create({
    data: {
      userId: input.session.userId,
      title: input.question.trim().slice(0, 120),
      scope: input.scope ?? "library",
      articleId: input.scope === "article" ? input.articleId ?? null : null,
    },
    select: { id: true },
  });
  return conversation.id;
}
