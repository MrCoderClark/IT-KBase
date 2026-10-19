import { splitSnippet } from "@/lib/kb/search";

/** Plain-text headline. Matched words are bold; the database text is not HTML. */
export function SearchSnippet({ snippet }: { snippet: string }) {
  const parts = splitSnippet(snippet);
  if (parts.length === 0) return null;
  return (
    <p className="truncate text-[12px] leading-4 text-fg-subtle">
      {parts.map((part, index) =>
        part.hit ? (
          <mark key={index} className="bg-transparent font-semibold text-fg">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </p>
  );
}
