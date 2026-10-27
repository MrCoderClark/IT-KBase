-- Per-stage timings for one import run (parse → segment → extract → validate → persist).
ALTER TABLE "public"."IngestionJob" ADD COLUMN "trace" JSONB;
