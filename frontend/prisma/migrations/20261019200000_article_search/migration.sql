-- Keep Article.searchVector current. A raw update of that column does not change updatedAt.

CREATE OR REPLACE FUNCTION public.block_plain_text(content jsonb, code text, alt text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  piece text := '';
  item jsonb;
BEGIN
  IF content IS NULL THEN
    piece := '';
  ELSIF jsonb_typeof(content) = 'string' THEN
    piece := content #>> '{}';
  ELSIF jsonb_typeof(content) = 'array' THEN
    FOR item IN SELECT value FROM jsonb_array_elements(content)
    LOOP
      piece := piece || ' ' || coalesce(item #>> '{}', '');
    END LOOP;
  ELSIF jsonb_typeof(content) = 'object' THEN
    piece := coalesce(content->>'title', '') || ' ' || coalesce(content->>'body', '');
  ELSE
    piece := content::text;
  END IF;

  piece := regexp_replace(piece, '<[^>]+>', ' ', 'g');
  piece := regexp_replace(piece, '&[a-zA-Z#0-9]+;', ' ', 'g');
  piece := regexp_replace(coalesce(piece, '') || ' ' || coalesce(code, '') || ' ' || coalesce(alt, ''), '[[:space:]]+', ' ', 'g');
  RETURN btrim(piece);
END;
$$;

CREATE OR REPLACE FUNCTION public.article_search_vector(
  article_id text,
  title text,
  summary text,
  version_id text
)
RETURNS tsvector
LANGUAGE sql
STABLE
AS $$
  SELECT
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce((
      SELECT string_agg(t.name, ' ')
      FROM "public"."ArticleTag" at
      JOIN "public"."Tag" t ON t.id = at."tagId"
      WHERE at."articleId" = article_id
    ), '')), 'B') ||
    setweight(to_tsvector('english', coalesce((
      SELECT string_agg(s.title, ' ')
      FROM "public"."Section" s
      WHERE s."versionId" = version_id
    ), '')), 'C') ||
    setweight(to_tsvector('english', coalesce((
      SELECT string_agg(public.block_plain_text(b.content, b.code, b."imageAlt"), ' ')
      FROM "public"."Block" b
      JOIN "public"."Section" s ON s.id = b."sectionId"
      WHERE s."versionId" = version_id
    ), '')), 'D');
$$;

CREATE OR REPLACE FUNCTION public.article_search_plain(article_id text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT btrim(concat_ws(' ',
    a.title,
    a.summary,
    (
      SELECT string_agg(t.name, ' ')
      FROM "public"."ArticleTag" at
      JOIN "public"."Tag" t ON t.id = at."tagId"
      WHERE at."articleId" = a.id
    ),
    (
      SELECT string_agg(s.title, ' ')
      FROM "public"."Section" s
      WHERE s."versionId" = a."currentVersionId"
    ),
    (
      SELECT string_agg(public.block_plain_text(b.content, b.code, b."imageAlt"), ' ')
      FROM "public"."Block" b
      JOIN "public"."Section" s ON s.id = b."sectionId"
      WHERE s."versionId" = a."currentVersionId"
    )
  ))
  FROM "public"."Article" a
  WHERE a.id = article_id;
$$;

CREATE OR REPLACE FUNCTION public.article_search_before()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."searchVector" := public.article_search_vector(NEW.id, NEW.title, NEW.summary, NEW."currentVersionId");
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Article_search_before"
BEFORE INSERT OR UPDATE ON "public"."Article"
FOR EACH ROW
EXECUTE FUNCTION public.article_search_before();

CREATE OR REPLACE FUNCTION public.refresh_article_search_row()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target text;
BEGIN
  IF TG_TABLE_NAME = 'Block' THEN
    SELECT a.id INTO target
    FROM "public"."Section" s
    JOIN "public"."Article" a ON a."currentVersionId" = s."versionId"
    WHERE s.id = COALESCE(NEW."sectionId", OLD."sectionId");
  ELSIF TG_TABLE_NAME = 'Section' THEN
    SELECT a.id INTO target
    FROM "public"."Article" a
    WHERE a."currentVersionId" = COALESCE(NEW."versionId", OLD."versionId");
  ELSIF TG_TABLE_NAME = 'ArticleTag' THEN
    target := COALESCE(NEW."articleId", OLD."articleId");
  ELSIF TG_TABLE_NAME = 'Tag' THEN
    UPDATE "public"."Article" a
    SET "searchVector" = public.article_search_vector(a.id, a.title, a.summary, a."currentVersionId")
    FROM "public"."ArticleTag" at
    WHERE at."tagId" = NEW.id AND at."articleId" = a.id;
    RETURN NULL;
  END IF;

  IF target IS NOT NULL THEN
    UPDATE "public"."Article" a
    SET "searchVector" = public.article_search_vector(a.id, a.title, a.summary, a."currentVersionId")
    WHERE a.id = target;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER "Block_search_refresh"
AFTER INSERT OR UPDATE OR DELETE ON "public"."Block"
FOR EACH ROW
EXECUTE FUNCTION public.refresh_article_search_row();

CREATE TRIGGER "Section_search_refresh"
AFTER INSERT OR UPDATE OR DELETE ON "public"."Section"
FOR EACH ROW
EXECUTE FUNCTION public.refresh_article_search_row();

CREATE TRIGGER "ArticleTag_search_refresh"
AFTER INSERT OR UPDATE OR DELETE ON "public"."ArticleTag"
FOR EACH ROW
EXECUTE FUNCTION public.refresh_article_search_row();

CREATE TRIGGER "Tag_search_refresh"
AFTER UPDATE OF name ON "public"."Tag"
FOR EACH ROW
EXECUTE FUNCTION public.refresh_article_search_row();

CREATE INDEX "Article_searchVector_idx" ON "public"."Article" USING GIN ("searchVector");

UPDATE "public"."Article"
SET "searchVector" = public.article_search_vector(id, title, summary, "currentVersionId");
