import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { articleSaveError, can, canEditArticle, canReadArticle, canReadArticleAnalytics, canReadArticleHistory, canReviewArticleFeedback, isPublicArticle, listableStatuses } from "./policy";

describe("role matrix", () => {
  it("lets every signed-in role read and only an admin manage the directory", () => {
    for (const role of ["reader", "author", "reviewer", "admin"] as const) {
      assert.equal(can(role, "article.read"), true);
    }
    assert.equal(can("reviewer", "admin.manage"), false);
    assert.equal(can("admin", "admin.manage"), true);
    assert.equal(can("author", "article.publish"), false);
    assert.equal(can("reviewer", "article.publish"), true);
    assert.equal(can("reviewer", "article.archive"), false);
    assert.equal(can("admin", "article.archive"), true);
    assert.equal(canReadArticleHistory("author"), false);
    assert.equal(canReadArticleHistory("reviewer"), true);
    assert.equal(canReadArticleHistory("admin"), true);
    assert.equal(canReviewArticleFeedback("author"), false);
    assert.equal(canReviewArticleFeedback("reviewer"), true);
    assert.equal(canReadArticleAnalytics("author"), false);
    assert.equal(canReadArticleAnalytics("reviewer"), true);
    assert.equal(canReadArticleAnalytics("admin"), true);
  });
});

describe("article reads", () => {
  const published = { authorId: "sarah", status: "published" as const };
  const draft = { authorId: "sarah", status: "draft" as const };
  const review = { authorId: "sarah", status: "in_review" as const };
  const archived = { authorId: "sarah", status: "archived" as const };

  it("lets a reader open published articles only", () => {
    assert.equal(canReadArticle("reader", "pat", published), true);
    assert.equal(canReadArticle("reader", "pat", draft), false);
    assert.equal(canReadArticle("reader", "sarah", draft), false);
    assert.equal(canReadArticle("reader", "pat", review), false);
    assert.equal(canReadArticle("reader", "pat", archived), false);
    assert.deepEqual(listableStatuses("reader"), ["published"]);
  });

  it("lets an author open their own drafts and hides archived articles", () => {
    assert.equal(canReadArticle("author", "sarah", draft), true);
    assert.equal(canReadArticle("author", "sarah", review), true);
    assert.equal(canReadArticle("author", "joe", draft), false);
    assert.equal(canReadArticle("author", "sarah", archived), false);
    assert.deepEqual(listableStatuses("author"), ["published", "in_review", "draft"]);
  });

  it("lets a reviewer open the library and an admin open archived articles", () => {
    assert.equal(canReadArticle("reviewer", "marcus", draft), true);
    assert.equal(canReadArticle("reviewer", "marcus", archived), false);
    assert.equal(canReadArticle("admin", "joe", archived), true);
    assert.deepEqual(listableStatuses("reviewer"), ["published", "in_review", "draft"]);
    assert.deepEqual(listableStatuses("admin"), ["published", "in_review", "draft", "archived"]);
  });
});

describe("public articles", () => {
  it("allows an anonymous read only when the article is published and public", () => {
    assert.equal(isPublicArticle({ status: "published", visibility: "public" }), true);
    assert.equal(isPublicArticle({ status: "draft", visibility: "public" }), false);
    assert.equal(isPublicArticle({ status: "in_review", visibility: "public" }), false);
    assert.equal(isPublicArticle({ status: "archived", visibility: "public" }), false);
    assert.equal(isPublicArticle({ status: "published", visibility: "private" }), false);
    assert.equal(isPublicArticle({ status: "published" }), false);
  });
});

describe("article edits", () => {
  it("lets an author edit their own draft and blocks someone else's", () => {
    assert.equal(
      canEditArticle("author", "sarah", { authorId: "sarah", status: "draft" }),
      true,
    );
    assert.equal(
      canEditArticle("author", "sarah", { authorId: "joe", status: "draft" }),
      false,
    );
    assert.equal(
      canEditArticle("author", "sarah", { authorId: "sarah", status: "published" }),
      false,
    );
    assert.equal(
      canEditArticle("reviewer", "marcus", { authorId: "sarah", status: "draft" }),
      true,
    );
    assert.equal(
      canEditArticle("reader", "pat", { authorId: "pat", status: "draft" }),
      false,
    );
  });

  it("rejects a reader create, an author publish, and a reviewer archive", () => {
    assert.match(
      articleSaveError({
        role: "reader",
        userId: "pat",
        existing: null,
        nextStatus: "draft",
        publishing: false,
      }) ?? "",
      /create/,
    );
    assert.match(
      articleSaveError({
        role: "author",
        userId: "sarah",
        existing: { authorId: "sarah", status: "draft" },
        nextStatus: "published",
        publishing: true,
      }) ?? "",
      /publish/,
    );
    assert.equal(
      articleSaveError({
        role: "author",
        userId: "sarah",
        existing: { authorId: "sarah", status: "draft" },
        nextStatus: "in_review",
        publishing: false,
      }),
      null,
    );
    assert.match(
      articleSaveError({
        role: "reviewer",
        userId: "marcus",
        existing: { authorId: "sarah", status: "published" },
        nextStatus: "archived",
        publishing: false,
      }) ?? "",
      /archive/,
    );
    assert.equal(
      articleSaveError({
        role: "admin",
        userId: "joe",
        existing: { authorId: "sarah", status: "published" },
        nextStatus: "archived",
        publishing: false,
      }),
      null,
    );
  });
});
