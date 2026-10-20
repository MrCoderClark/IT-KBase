-- CreateTable
CREATE TABLE "ArticleNote" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArticleNote_articleId_createdAt_idx" ON "ArticleNote"("articleId", "createdAt");

-- AddForeignKey
ALTER TABLE "ArticleNote" ADD CONSTRAINT "ArticleNote_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleNote" ADD CONSTRAINT "ArticleNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
