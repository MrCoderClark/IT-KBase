-- Per-page permissions (Docs/specs/12-per-page-permissions.md).
-- Narrow who may open a page; children inherit until they set their own mode.

CREATE TYPE "public"."ArticleAccessMode" AS ENUM ('inherit', 'library', 'role_floor');

ALTER TABLE "public"."Article"
  ADD COLUMN "accessMode" "public"."ArticleAccessMode" NOT NULL DEFAULT 'inherit',
  ADD COLUMN "accessRoleFloor" "public"."Role";
