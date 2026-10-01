ALTER TABLE "draft" ALTER COLUMN "document_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "draft" ALTER COLUMN "search" SET EXPRESSION AS (to_tsvector('simple', title || ' ' || coalesce(replace(document_id, '-', ' '), '') || ' ' || jsonb_path_query_array(fields, 'strict $.**.company')::text || ' ' || jsonb_path_query_array(fields, 'strict $.**.name')::text));
