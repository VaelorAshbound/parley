import { createDraft, getDraft, updateDraft } from "@workspace/db"
import {
  applyFieldChanges,
  definitionOf,
  initialValues,
  isDocumentId,
  type DocumentId,
} from "@workspace/documents"

import { z } from "../zod"
import { authed, draftOwner } from "./base"

const documentId = z.custom<DocumentId>(isDocumentId, {
  message: "Unknown document.",
})
const draftId = z.object({ id: z.uuid() })

export const drafts = {
  create: authed
    .input(
      z.object({
        documentId,
        // The user's own calendar day, for fields that default to today.
        today: z.iso.date(),
      })
    )
    .handler(({ context, input }) => {
      const definition = definitionOf(input.documentId)
      return createDraft(context.db, {
        userId: context.user.id,
        documentId: input.documentId,
        title: definition.name,
        fields: initialValues(definition, { today: input.today }),
      })
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
    .use(draftOwner, (input) => input.id)
    .handler(({ context, input, errors }) =>
      // The row lock makes a second edit wait for this one, so neither edit
      // is lost.
      context.db.transaction(async (tx) => {
        const key = { id: input.id, userId: context.user.id }
        const draft = await getDraft(tx, key, { lock: true })
        // Deleted between the owner check and the lock.
        if (!draft) throw errors.NOT_FOUND()
        const definition = definitionOf(draft.documentId)
        const result = applyFieldChanges(
          definition,
          definition.draftSchema.parse(draft.fields),
          input.changes
        )
        const saved =
          result.applied.length > 0
            ? await updateDraft(tx, key, { fields: result.values })
            : draft
        return {
          draft: saved ?? draft,
          applied: result.applied,
          rejected: result.rejected,
          inverse: result.inverse,
        }
      })
    ),
}
