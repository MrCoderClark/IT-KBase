-- DropIndex
DROP INDEX "Article_searchVector_idx";

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "Article_parentId_order_idx" ON "Article"("parentId", "order");

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;
