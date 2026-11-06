-- CreateEnum
CREATE TYPE "AssistantScope" AS ENUM ('library', 'article');

-- CreateEnum
CREATE TYPE "AssistantRole" AS ENUM ('user', 'assistant');

-- CreateEnum
CREATE TYPE "GapStatus" AS ENUM ('open', 'drafted', 'dismissed');

-- DropIndex
DROP INDEX "ArticleChunk_embedding_hnsw_idx";

-- DropIndex
DROP INDEX "ArticleChunk_searchVector_idx";

-- AlterTable
ALTER TABLE "site_setting" ALTER COLUMN "accentHex" SET DEFAULT '#1A5AE0';

-- CreateTable
CREATE TABLE "AssistantConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "scope" "AssistantScope" NOT NULL DEFAULT 'library',
    "articleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AssistantRole" NOT NULL,
    "content" TEXT NOT NULL,
    "citations" JSONB,
    "grounded" BOOLEAN NOT NULL DEFAULT true,
    "model" TEXT,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "latencyMs" INTEGER,
    "traceId" TEXT,
    "helpful" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeGap" (
    "id" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "sampleQuestion" TEXT NOT NULL,
    "askCount" INTEGER NOT NULL DEFAULT 1,
    "lastAskedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "GapStatus" NOT NULL DEFAULT 'open',
    "draftArticleId" TEXT,

    CONSTRAINT "KnowledgeGap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssistantConversation_userId_updatedAt_idx" ON "AssistantConversation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "AssistantMessage_conversationId_createdAt_idx" ON "AssistantMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeGap_normalized_key" ON "KnowledgeGap"("normalized");

-- CreateIndex
CREATE INDEX "KnowledgeGap_status_askCount_idx" ON "KnowledgeGap"("status", "askCount");

-- AddForeignKey
ALTER TABLE "AssistantMessage" ADD CONSTRAINT "AssistantMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AssistantConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
