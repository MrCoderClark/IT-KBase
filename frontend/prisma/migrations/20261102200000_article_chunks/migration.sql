-- AI Assistant retrieval chunks (spec 20, ADR 0004).
-- Requires pgvector on the server: infra/pgvector/README.md

CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "public"."ChunkKind" AS ENUM ('prose', 'code');

-- CreateTable
CREATE TABLE "public"."ArticleChunk" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "blockId" TEXT,
    "kind" "public"."ChunkKind" NOT NULL,
    "sectionKind" "public"."SectionKind" NOT NULL,
    "sectionTitle" TEXT NOT NULL,
    "ord" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "searchVector" tsvector,
    "embedding" vector(1536),
    "embeddingModel" TEXT,
    "embeddedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArticleChunk_articleId_ord_idx" ON "public"."ArticleChunk"("articleId", "ord");

-- CreateIndex
CREATE INDEX "ArticleChunk_versionId_idx" ON "public"."ArticleChunk"("versionId");

-- CreateIndex
CREATE INDEX "ArticleChunk_contentHash_idx" ON "public"."ArticleChunk"("contentHash");

-- AddForeignKey
ALTER TABLE "public"."ArticleChunk" ADD CONSTRAINT "ArticleChunk_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ArticleChunk" ADD CONSTRAINT "ArticleChunk_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "public"."ArticleVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keyword side of hybrid retrieval. Section title weighted above body text so a
-- chunk under "Troubleshooting 0x80180014" ranks ahead of a passing mention.
CREATE OR REPLACE FUNCTION public.article_chunk_search_before()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', coalesce(NEW."sectionTitle", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."text", '')), 'D');
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ArticleChunk_search_before"
BEFORE INSERT OR UPDATE OF "text", "sectionTitle" ON "public"."ArticleChunk"
FOR EACH ROW
EXECUTE FUNCTION public.article_chunk_search_before();

CREATE INDEX "ArticleChunk_searchVector_idx" ON "public"."ArticleChunk" USING GIN ("searchVector");

-- Vector side of hybrid retrieval (cosine distance, matches embedding model output).
CREATE INDEX "ArticleChunk_embedding_hnsw_idx" ON "public"."ArticleChunk" USING hnsw ("embedding" vector_cosine_ops);
