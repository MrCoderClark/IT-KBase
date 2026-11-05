/**
 * Turns an article version's sections and blocks into retrieval chunks
 * (spec 20 §5.2, ADR 0004): one `prose` chunk per section that has prose, and
 * one `code` chunk per block that carries a command — kept verbatim so the
 * assistant can quote it without inventing anything.
 *
 * Pure and DB-free so it unit-tests under `tsx --test`. The indexer loads the
 * version with Prisma, calls `chunkVersion`, then handles hashing, embedding,
 * and persistence. Prose flattening mirrors the Postgres `block_plain_text`
 * function (migration `20261019200000_article_search`) so a chunk's keyword
 * side reads the same text the article-level FTS already indexes.
 */

export type ChunkSectionKind =
  | "overview"
  | "prerequisites"
  | "steps"
  | "verification"
  | "troubleshooting"
  | "related"
  | "custom";

export type ChunkBlock = {
  id: string;
  order: number;
  /** Block.content (TipTap JSON, a string, or an array/object). */
  content: unknown;
  /** Block.code — a command kept whole as its own chunk. */
  code: string | null;
  imageAlt: string | null;
};

export type ChunkSection = {
  id: string;
  kind: ChunkSectionKind;
  title: string;
  order: number;
  blocks: ChunkBlock[];
};

export type ChunkKind = "prose" | "code";

export type ChunkSpec = {
  sectionId: string;
  /** Set for `kind = code`; identifies the source block. */
  blockId: string | null;
  kind: ChunkKind;
  sectionKind: ChunkSectionKind;
  sectionTitle: string;
  /** Position of the chunk across the whole version, from 0. */
  ord: number;
  text: string;
  tokenCount: number;
};

/** Rough token estimate for bundle capping (~6k, §5.2). ~4 chars per token. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.trim().length / 4));
}

/**
 * Flatten one block's prose to plain text, mirroring the SQL
 * `block_plain_text` — minus the code, which becomes its own chunk. The image
 * alt text is kept because it describes the step.
 */
export function blockProseText(content: unknown, imageAlt: string | null): string {
  let piece = "";
  if (content === null || content === undefined) {
    piece = "";
  } else if (typeof content === "string") {
    piece = content;
  } else if (Array.isArray(content)) {
    piece = content.map((item) => (typeof item === "string" ? item : "")).join(" ");
  } else if (typeof content === "object") {
    const record = content as Record<string, unknown>;
    const title = typeof record.title === "string" ? record.title : "";
    const body = typeof record.body === "string" ? record.body : "";
    piece = `${title} ${body}`;
  } else {
    piece = String(content);
  }

  const alt = imageAlt ?? "";
  return collapse(stripMarkup(`${piece} ${alt}`));
}

function stripMarkup(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/&[a-zA-Z#0-9]+;/g, " ");
}

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Build the chunk specs for a version. Sections and blocks are read in their
 * stored order; `ord` increments across the whole version, prose before code
 * within each section. Sections with no prose contribute no prose chunk.
 */
export function chunkVersion(sections: ChunkSection[]): ChunkSpec[] {
  const specs: ChunkSpec[] = [];
  let ord = 0;

  for (const section of [...sections].sort((a, b) => a.order - b.order)) {
    const blocks = [...section.blocks].sort((a, b) => a.order - b.order);

    const prose = collapse(
      blocks.map((block) => blockProseText(block.content, block.imageAlt)).join(" "),
    );
    if (prose) {
      specs.push({
        sectionId: section.id,
        blockId: null,
        kind: "prose",
        sectionKind: section.kind,
        sectionTitle: section.title,
        ord: ord++,
        text: prose,
        tokenCount: estimateTokens(prose),
      });
    }

    for (const block of blocks) {
      const code = (block.code ?? "").replace(/\r\n/g, "\n").trimEnd();
      if (!code.trim()) continue;
      specs.push({
        sectionId: section.id,
        blockId: block.id,
        kind: "code",
        sectionKind: section.kind,
        sectionTitle: section.title,
        ord: ord++,
        text: code,
        tokenCount: estimateTokens(code),
      });
    }
  }

  return specs;
}
