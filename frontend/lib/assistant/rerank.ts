/**
 * Deterministic reranker for the AI Assistant (spec 20 §12 AI-5, "smarter
 * retrieval"). Reorders the RRF-fused, access-gated candidates before they are
 * capped to the final top-k, using lexical/structural signals that pure rank
 * fusion under-weights: whether a chunk literally contains the question's exact
 * tokens (error codes / KB IDs / cmdlets, A4), how much of the question's wording
 * it covers, and whether the article or section title matches.
 *
 * It only reorders — the fused `score` is left intact for grounding and
 * telemetry, and the sort is stable, so a chunk is never demoted below another
 * with the same signals and a lower fused rank. Pure and DB-free, so it unit-tests
 * under `tsx --test`. An LLM / cross-encoder reranker is a later slice.
 */

/** The fields the reranker scores over — a structural subset of RetrievedChunk. */
export interface Rerankable {
  text: string;
  articleTitle: string;
  sectionTitle: string;
  /** The fused RRF score; the backbone of the ordering. */
  score: number;
}

/**
 * Signal weights, applied as a multiplier on the fused score. Deliberately modest
 * so fusion stays the backbone; tune on the golden set alongside GROUNDED_MIN_SCORE.
 */
export const RERANK_WEIGHTS = { token: 0.6, term: 0.3, title: 0.15 };

const MIN_WORD_LEN = 3;

// Common question words that carry no retrieval signal.
const STOPWORDS = new Set([
  "the", "and", "for", "how", "what", "why", "with", "you", "your", "that", "this",
  "from", "when", "where", "does", "did", "can", "are", "was", "were", "has", "have",
  "will", "its", "it's", "into", "onto", "about", "after", "before", "then", "than",
  "not", "but", "get", "got", "use", "using", "via", "per", "any", "all", "out",
]);

/** Distinct lowercased content words of a question, minus stopwords and short tokens. */
export function contentWords(question: string): string[] {
  const seen = new Set<string>();
  for (const raw of question.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length >= MIN_WORD_LEN && !STOPWORDS.has(raw)) seen.add(raw);
  }
  return [...seen];
}

function fraction(hits: number, total: number): number {
  return total > 0 ? hits / total : 0;
}

/** The multiplier a single chunk earns from the question's signals, ≥ 1. */
export function rerankBoost(
  haystack: { text: string; title: string },
  tokens: string[],
  words: string[],
): number {
  const text = haystack.text.toLowerCase();
  const title = haystack.title.toLowerCase();

  const tokenHits = tokens.filter((token) => text.includes(token.toLowerCase())).length;
  const termHits = words.filter((word) => text.includes(word)).length;
  const titleHits = words.filter((word) => title.includes(word)).length;

  return (
    1 +
    RERANK_WEIGHTS.token * fraction(tokenHits, tokens.length) +
    RERANK_WEIGHTS.term * fraction(termHits, words.length) +
    RERANK_WEIGHTS.title * fraction(titleHits, words.length)
  );
}

/**
 * Reorder `chunks` by fused score × signal boost, stably (ties keep their
 * incoming fused order). `tokens` are the exact tokens already extracted for the
 * query; the fused order is assumed to be the incoming array order.
 */
export function rerankChunks<T extends Rerankable>(
  question: string,
  tokens: string[],
  chunks: T[],
): T[] {
  if (chunks.length < 2) return chunks;
  const words = contentWords(question);
  return chunks
    .map((chunk, index) => ({
      chunk,
      index,
      rr: chunk.score * rerankBoost({ text: chunk.text, title: `${chunk.articleTitle} ${chunk.sectionTitle}` }, tokens, words),
    }))
    .sort((a, b) => b.rr - a.rr || a.index - b.index)
    .map((entry) => entry.chunk);
}
