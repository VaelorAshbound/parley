import type { DocumentId } from "@workspace/documents"
import { relations, sql } from "drizzle-orm"
import {
  bigint,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { user } from "./auth-schema.ts"

// Parley's own tables (spec §2 Data model). The Better Auth tables are
// generated into auth-schema.ts by `pnpm db:auth-schema`; don't edit that file.

/** A JSON object whose shape the database doesn't know. */
export type JsonObject = { [key: string]: unknown }

const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
})

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull()

export const draftStatus = pgEnum("draft_status", ["drafting", "complete"])

export const draft = pgTable(
  "draft",
  {
    // uuidv7 (Postgres 18) is time-ordered, so new rows land at the end of
    // the primary key index instead of at random pages.
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Null until the chat picks the agreement (T17: a chat can start before
    // the user knows which document they need).
    documentId: text("document_id").$type<DocumentId>(),
    title: text("title").notNull(),
    // Checked by the document's own Zod schema before the engine uses it,
    // never trusted as typed here (spec §5 Drizzle).
    fields: jsonb("fields").$type<JsonObject>().notNull().default({}),
    status: draftStatus("status").notNull().default("drafting"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    // Set on the first export only: the monthly quota counts this (spec §2).
    firstExportedAt: timestamp("first_exported_at", { withTimezone: true }),
    // Sidebar search: the title, the document type and every party's company
    // and name, whatever the document calls its parties. 'simple' keeps names
    // as typed (no English stemming of "Acme").
    search: tsvector("search")
      .notNull()
      .generatedAlwaysAs(
        sql`to_tsvector('simple', title || ' ' || coalesce(replace(document_id, '-', ' '), '') || ' ' || jsonb_path_query_array(fields, 'strict $.**.company')::text || ' ' || jsonb_path_query_array(fields, 'strict $.**.name')::text)`
      ),
  },
  (table) => [
    // NULLS FIRST matches a plain ORDER BY updated_at DESC; Drizzle's default
    // NULLS LAST would stop Postgres from reading the order off the index.
    index("draft_user_id_updated_at_idx").on(
      table.userId,
      table.updatedAt.desc().nullsFirst()
    ),
    index("draft_search_idx").using("gin", table.search),
  ]
)

export const messageRole = pgEnum("message_role", [
  "system",
  "user",
  "assistant",
])

export const message = pgTable(
  "message",
  {
    // AI SDK message ids are strings it makes itself.
    id: text("id").primaryKey(),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => draft.id, { onDelete: "cascade" }),
    role: messageRole("role").notNull(),
    // AI SDK UIMessage parts, checked with its validateUIMessages on read.
    parts: jsonb("parts").$type<unknown[]>().notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("message_draft_id_created_at_idx").on(table.draftId, table.createdAt),
  ]
)

export const share = pgTable(
  "share",
  {
    // 128 random bits, base64url. The primary key is the lookup index.
    token: text("token").primaryKey(),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => draft.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [index("share_draft_id_idx").on(table.draftId)]
)

export const aiUsage = pgTable(
  "ai_usage",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // The UTC calendar day, as "YYYY-MM-DD" (Temporal.PlainDate).
    day: date("day", { mode: "string" }).notNull(),
    // The daily message limits count these (spec §2 Limits).
    messages: integer("messages").notNull().default(0),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    // Millionths of a dollar: exact sums, and no float or numeric strings.
    costMicroUsd: bigint("cost_micro_usd", { mode: "number" })
      .notNull()
      .default(0),
  },
  // One row per user and day. The key doubles as the (user_id, day) index.
  (table) => [primaryKey({ columns: [table.userId, table.day] })]
)

/**
 * One row per counted document (spec §2 Quota): a draft's first export. The
 * monthly limit counts these rows, not the drafts, so deleting a downloaded
 * draft doesn't give its place back (ADR-0006). No foreign key to the draft
 * for that reason; the rows go with the user.
 */
export const countedExport = pgTable(
  "counted_export",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    draftId: uuid("draft_id").notNull(),
    // The agreement counted: switching a draft to another one and back
    // doesn't count the first again (spec §2 Quota).
    documentId: text("document_id").$type<DocumentId>().notNull(),
    countedAt: timestamp("counted_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("counted_export_user_id_counted_at_idx").on(
      table.userId,
      table.countedAt
    ),
    uniqueIndex("counted_export_draft_id_document_id_idx").on(
      table.draftId,
      table.documentId
    ),
  ]
)

export const draftRelations = relations(draft, ({ one, many }) => ({
  user: one(user, { fields: [draft.userId], references: [user.id] }),
  messages: many(message),
  shares: many(share),
}))

export const messageRelations = relations(message, ({ one }) => ({
  draft: one(draft, { fields: [message.draftId], references: [draft.id] }),
}))

export const shareRelations = relations(share, ({ one }) => ({
  draft: one(draft, { fields: [share.draftId], references: [draft.id] }),
}))
