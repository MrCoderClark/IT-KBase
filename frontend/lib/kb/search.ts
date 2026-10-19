const START = "\u0001";
const STOP = "\u0002";

/** Bound the words we send to Postgres. Null means "don't search". */
export function searchQuery(raw: string): string | null {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (cleaned.length < 2 || cleaned.length > 80) return cleaned.length > 80 ? cleaned.slice(0, 80) : null;
  return cleaned;
}

export type SnippetPart = { text: string; hit: boolean };

/** Split a headline that marks hits with ASCII control characters. */
export function splitSnippet(raw: string): SnippetPart[] {
  const parts: SnippetPart[] = [];
  const pattern = new RegExp(`${START}([^${STOP}]*)${STOP}`, "g");
  let last = 0;
  for (const match of raw.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ text: raw.slice(last, index), hit: false });
    if (match[1]) parts.push({ text: match[1], hit: true });
    last = index + match[0].length;
  }
  if (last < raw.length) parts.push({ text: raw.slice(last), hit: false });
  return parts;
}

export const SNIPPET_START = START;
export const SNIPPET_STOP = STOP;
