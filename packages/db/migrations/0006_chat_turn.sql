CREATE TYPE "public"."chat_turn_outcome" AS ENUM('done', 'failed');--> statement-breakpoint
CREATE TABLE "chat_turn" (
	"draft_id" uuid PRIMARY KEY NOT NULL,
	"turn_id" text NOT NULL,
	"started_at" timestamp (3) with time zone NOT NULL,
	"outcome" "chat_turn_outcome"
);
--> statement-breakpoint
ALTER TABLE "chat_turn" ADD CONSTRAINT "chat_turn_draft_id_draft_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."draft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- PAR-7: the turn was kept as a draft's one `system` row of the chat
-- (id 'turn:<draft id>', parts [{type: 'data-turn', data: {id, startedAt,
-- outcome}}]). Carry it over, so a turn still running stays one, then take
-- those rows out of the chat. A malformed row is dropped, as turnOf read it
-- as no turn.
INSERT INTO "chat_turn" ("draft_id", "turn_id", "started_at", "outcome")
SELECT
	"draft_id",
	"parts" -> 0 -> 'data' ->> 'id',
	to_timestamp(("parts" -> 0 -> 'data' ->> 'startedAt')::double precision / 1000),
	CASE "parts" -> 0 -> 'data' ->> 'outcome'
		WHEN 'done' THEN 'done'::"chat_turn_outcome"
		WHEN 'failed' THEN 'failed'::"chat_turn_outcome"
	END
FROM "message"
WHERE "role" = 'system'
	AND "id" = 'turn:' || "draft_id"::text
	AND jsonb_typeof("parts" -> 0 -> 'data' -> 'id') = 'string'
	AND jsonb_typeof("parts" -> 0 -> 'data' -> 'startedAt') = 'number';--> statement-breakpoint
DELETE FROM "message" WHERE "role" = 'system' AND "id" = 'turn:' || "draft_id"::text;
