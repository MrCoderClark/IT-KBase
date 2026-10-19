/** How many articles the command palette lists under Recent. */
export const RECENT_ARTICLE_LIMIT = 10;

export type RecentTouch = {
  slug: string;
  title: string;
  status: string;
  category: string | null;
  /** ISO timestamp. Later values win for the same article. */
  at: string;
};

export type RecentArticle = {
  slug: string;
  title: string;
  status: string;
  category: string | null;
};

/** One row per article, newest open or edit first. */
export function latestRecentArticles(
  touches: RecentTouch[],
  limit = RECENT_ARTICLE_LIMIT,
): RecentArticle[] {
  const best = new Map<string, RecentTouch>();
  for (const touch of touches) {
    const current = best.get(touch.slug);
    if (!current || touch.at > current.at) best.set(touch.slug, touch);
  }
  return [...best.values()]
    .sort((a, b) => {
      if (a.at !== b.at) return a.at < b.at ? 1 : -1;
      return a.title.localeCompare(b.title);
    })
    .slice(0, limit)
    .map(({ slug, title, status, category }) => ({ slug, title, status, category }));
}
