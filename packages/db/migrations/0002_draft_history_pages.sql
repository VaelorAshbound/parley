-- A GIN index over a text column (user_id) needs btree_gin, which Neon supports. drizzle-kit doesn't write extensions, so this line was added by hand (T22).
CREATE EXTENSION IF NOT EXISTS btree_gin;--> statement-breakpoint
DROP INDEX "draft_user_id_updated_at_idx";--> statement-breakpoint
DROP INDEX "draft_search_idx";--> statement-breakpoint
ALTER TABLE "draft" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "draft" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
CREATE INDEX "draft_user_id_updated_at_idx" ON "draft" USING btree ("user_id","updated_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "draft_search_idx" ON "draft" USING gin ("user_id","search");