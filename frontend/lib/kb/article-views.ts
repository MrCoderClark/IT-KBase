/** UTC day key, `yyyymmdd`, so a view resets at midnight UTC. */
export function viewDay(now: Date): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/** Signed-in people count once across browsers. Anonymous readers use a browser id. */
export function articleViewerKey(userId: string | null, anonId: string): string {
  return userId ? `user:${userId}` : `anon:${anonId}`;
}
