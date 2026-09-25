CREATE TABLE "counted_export" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" text NOT NULL,
	"draft_id" uuid NOT NULL,
	"document_id" text NOT NULL,
	"counted_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "counted_export" ADD CONSTRAINT "counted_export_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "counted_export_user_id_counted_at_idx" ON "counted_export" USING btree ("user_id","counted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "counted_export_draft_id_document_id_idx" ON "counted_export" USING btree ("draft_id","document_id");