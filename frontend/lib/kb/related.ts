/**
 * Lexical related-article helpers (no embeddings).
 * Query text feeds Postgres `plainto_tsquery` against `Article.searchVector`.
 */

export type RelatedSource = {
  title: string;
  summary?: string | null;
  tags?: { name: string }[];
};

/**
 * Title, tag names, and a short summary — enough signal for FTS relatedness
 * without dumping the whole body into the query.
 */
export function relatedSearchText(article: RelatedSource): string | null {
  const parts = [
    article.title.trim(),
    ...(article.tags ?? []).map((tag) => tag.name.trim()),
    (article.summary ?? "").trim(),
  ].filter(Boolean);
  const cleaned = parts.join(" ").replace(/\s+/g, " ").trim();
  if (cleaned.length < 2) return null;
  return cleaned.length > 200 ? cleaned.slice(0, 200) : cleaned;
}
