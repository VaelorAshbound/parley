import {
  countedAt,
  createDraft,
  deleteDraft,
  duplicateDraft,
  getDraft,
  listDrafts,
  updateDraft,
} from "@workspace/db"
import {
  applyFieldChanges,
  definitionOf,
  initialValues,
  isDocumentId,
  missingFields,
  switchDocument,
  type DocumentId,
} from "@workspace/documents"

import { copyTitle, draftTitle, QUERY_MAX } from "../../lib/drafts"

import { z } from "../zod"
import { authed, draftOwner } from "./base"

const documentId = z.custom<DocumentId>(isDocumentId, {
  message: "Unknown document.",
})
const draftId = z.object({ id: z.uuid() })
// The user's own calendar day, for fields that default to today.
const today = z.iso.date()

/** A draft's title until the user renames it: the agreement's name. */
const NEW_DRAFT = "New draft"
function defaultTitle(id: DocumentId | null) {
  return id === null ? NEW_DRAFT : definitionOf(id).name
}

export const drafts = {
  /**
   * A new draft. Without a document, the chat picks one first (T17: you can
   * start by describing the deal).
   */
  create: authed
    .input(z.object({ documentId: documentId.optional(), today }))
    .handler(({ context, input }) => {
      const id = input.documentId ?? null
      return createDraft(context.db, {
        userId: context.user.id,
        documentId: id,
        title: defaultTitle(id),
        fields:
          id === null
            ? {}
            : initialValues(definitionOf(id), { today: input.today }),
      })
    }),

  /**
   * Picks the draft's agreement, for the AI's chooseDocument tool and the
   * picker. Switching keeps the values that fit the new document; a title
   * the user chose stays.
   */
  chooseDocument: authed
    .input(draftId.extend({ documentId, today }))
    .use(draftOwner, (input) => input.id)
    .handler(({ context, input, errors }) =>
      context.db.transaction(async (tx) => {
        const key = { id: input.id, userId: context.user.id }
        const draft = await getDraft(tx, key, { lock: true })
        if (!draft) throw errors.NOT_FOUND()
        const saved = await updateDraft(tx, key, {
          documentId: input.documentId,
          title:
            draft.title === defaultTitle(draft.documentId)
              ? defaultTitle(input.documentId)
              : draft.title,
          fields: switchDocument(draft.fields, definitionOf(input.documentId), {
            today: input.today,
          }),
          // Another agreement is drafted from here: markComplete checks it
          // again before anything trusts it as finished, and its first
          // download counts as a new document, unless this draft was
          // downloaded as it before (spec §2 Quota).
          ...(input.documentId !== draft.documentId && {
            status: "drafting" as const,
            firstExportedAt: await countedAt(tx, {
              draftId: draft.id,
              documentId: input.documentId,
            }),
          }),
        })
        return saved ?? draft
      })
    ),

  /**
   * The history (sidebar, search, /drafts): the caller's drafts, last
   * changed first. `query` matches titles, document types and party names
   * from the start of each word; `after` is the last draft of the page
   * before.
   */
  list: authed
    .input(
      z.object({
        query: z.string().max(QUERY_MAX).optional(),
        documentId: documentId.optional(),
        after: z.object({ id: z.uuid(), updatedAt: z.date() }).optional(),
        limit: z.int().min(1).max(100).optional(),
      })
    )
    .handler(({ context, input }) =>
      listDrafts(context.db, { userId: context.user.id, ...input })
    ),

  rename: authed
    .input(draftId.extend({ title: draftTitle }))
    .use(draftOwner, (input) => input.id)
    .handler(async ({ context, input, errors }) => {
      const saved = await updateDraft(
        context.db,
        { id: input.id, userId: context.user.id },
        { title: input.title }
      )
      // Deleted between the owner check and the update.
      if (!saved) throw errors.NOT_FOUND()
      return saved
    }),

  /** A copy with the same agreement and answers, and an empty chat. */
  duplicate: authed
    .input(draftId)
    .use(draftOwner, (input) => input.id)
    .handler(async ({ context, input, errors }) => {
      const copy = await duplicateDraft(
        context.db,
        { id: input.id, userId: context.user.id },
        { title: copyTitle(context.draft.title) }
      )
      if (!copy) throw errors.NOT_FOUND()
      return copy
    }),

  /**
   * Deletes the draft with its chat and share links. The app waits out its
   * undo toast before it calls this, so an undo never needs the server.
   */
  delete: authed
    .input(draftId)
    .use(draftOwner, (input) => input.id)
    .handler(async ({ context, input }) => {
      await deleteDraft(context.db, { id: input.id, userId: context.user.id })
    }),

  get: authed
    .input(draftId)
    .use(draftOwner, (input) => input.id)
    .handler(({ context }) => context.draft),

  /**
   * The one way field values change, for the editor and (T17) the AI. Each
   * change is checked on its own; the rejected ones come back with reasons,
   * and `inverse` undoes the applied ones (spec §2 Document engine).
   */
  updateFields: authed
    .input(
      draftId.extend({
        changes: z
          .array(
            z.object({
              key: z.string().max(100),
              value: z.unknown(),
              expected: z.unknown().optional(),
            })
          )
          .min(1)
          .max(50),
      })
    )
    .errors({ NO_DOCUMENT: { message: "Pick an agreement first." } })
    .use(draftOwner, (input) => input.id)
    .handler(({ context, input, errors }) =>
      // The row lock makes a second edit wait for this one, so neither edit
      // is lost.
      context.db.transaction(async (tx) => {
        const key = { id: input.id, userId: context.user.id }
        const draft = await getDraft(tx, key, { lock: true })
        // Deleted between the owner check and the lock.
        if (!draft) throw errors.NOT_FOUND()
        if (draft.documentId === null) throw errors.NO_DOCUMENT()
        const definition = definitionOf(draft.documentId)
        const result = applyFieldChanges(
          definition,
          definition.draftSchema.parse(draft.fields),
          input.changes
        )
        const saved =
          result.applied.length > 0
            ? await updateDraft(tx, key, {
                fields: result.values,
                // A finished draft stays finished only while it still is.
                ...(draft.status === "complete" &&
                  missingFields(definition, result.values).length > 0 && {
                    status: "drafting" as const,
                  }),
              })
            : draft
        return {
          draft: saved ?? draft,
          applied: result.applied,
          rejected: result.rejected,
          inverse: result.inverse,
        }
      })
    ),
  /**
   * Marks the draft complete when every required field holds a valid value
   * (the AI's markComplete, then export). Otherwise nothing changes and the
   * missing fields come back, named, for the AI to ask about.
   */
  markComplete: authed
    .input(draftId)
    .errors({ NO_DOCUMENT: { message: "Pick an agreement first." } })
    .use(draftOwner, (input) => input.id)
    .handler(({ context, input, errors }) =>
      context.db.transaction(async (tx) => {
        const key = { id: input.id, userId: context.user.id }
        const draft = await getDraft(tx, key, { lock: true })
        if (!draft) throw errors.NOT_FOUND()
        if (draft.documentId === null) throw errors.NO_DOCUMENT()
        const definition = definitionOf(draft.documentId)
        const missing = missingFields(
          definition,
          definition.draftSchema.parse(draft.fields)
        ).map((each) => ({
          ...each,
          label: definition.fields[each.key]?.label ?? each.key,
        }))
        if (missing.length === 0 && draft.status !== "complete")
          await updateDraft(tx, key, { status: "complete" })
        return { complete: missing.length === 0, missing }
      })
    ),
}
