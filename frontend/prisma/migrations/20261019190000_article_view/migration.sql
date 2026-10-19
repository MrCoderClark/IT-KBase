-- One counted open per viewer per UTC day. The Article.views total is incremented only for a new row.

CREATE TABLE "public"."ArticleView" (
    "articleId" TEXT NOT NULL,
    "viewerKey" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleView_pkey" PRIMARY KEY ("articleId","viewerKey","day")
);

CREATE INDEX "ArticleView_day_idx" ON "public"."ArticleView"("day");

ALTER TABLE "public"."ArticleView" ADD CONSTRAINT "ArticleView_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "public"."Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
