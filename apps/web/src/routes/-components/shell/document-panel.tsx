import { Link, useNavigate, useRouteContext } from "@tanstack/react-router"
import { definitionOf, render, type DocumentId } from "@workspace/documents"
import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { FileTextIcon, XIcon } from "lucide-react"
import { useEffect, useRef } from "react"

import { DocumentView } from "@/features/document-preview/document-view"
import { FieldEditor } from "@/features/field-editor/field-editor"
import { useSaveField } from "@/features/field-editor/use-save-field"
import { useUiStore } from "@/lib/ui-store"

// The right panel (spec §1 Layout): the live document, where any value can be
// clicked and edited in place. The field being edited is in the URL
// (`?field=party1.email`), so a reload or a shared link opens the same
// editor. T24 and T25 add Download and Share.

type Draft = {
  id: string
  documentId: DocumentId
  fields: Record<string, unknown>
}

export function DocumentPanel({
  name,
  draft,
  editing,
}: {
  name: string
  draft: Draft
  /** The field being edited, maybe with a part: "party1.email". */
  editing: string | undefined
}) {
  const { orpc } = useRouteContext({ from: "/_app/d/$draftId" })
  const navigate = useNavigate()
  const save = useSaveField(orpc, draft.id)
  const refused = useUiStore((state) => state.refused)
  const setRefused = useUiStore((state) => state.setRefused)
  const definition = definitionOf(draft.documentId)
  // Stored values are checked on the way in: a draft is only ever shown in
  // the shape its document defines.
  const values = definition.draftSchema.parse(draft.fields)
  const document = render(definition, values)
  const panel = useRef<HTMLDivElement>(null)
  const editingKey = editing?.split(".")[0]
  const known = editingKey !== undefined && editingKey in definition.fields
  const recovery =
    refused?.draftId === draft.id && refused.fieldKey === editingKey
      ? refused
      : undefined

  const edit = (path: string | undefined) =>
    void navigate({
      to: ".",
      search: (prev) => ({ ...prev, field: path }),
      replace: true,
    })

  // When an editor closes, focus goes back to what opened it: the value
  // that was clicked, or else its row.
  const lastEdited = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (known) {
      lastEdited.current = editing
      return
    }
    const path = lastEdited.current
    lastEdited.current = undefined
    if (path === undefined) return
    const find = (selector: string) =>
      panel.current?.querySelector<HTMLElement>(selector)
    const key = CSS.escape(path.split(".")[0] ?? path)
    ;(
      find(`[data-edit="${CSS.escape(path)}"]`) ??
      find(`[data-edit="${key}"], [data-edit^="${key}."]`)
    )?.focus()
  }, [known, editing])

  return (
    <section
      aria-label="Live document"
      className="flex h-full min-w-0 flex-col bg-paper-deep"
    >
      <header className="flex h-14 shrink-0 items-center gap-1.5 pr-3 pl-4">
        <FileTextIcon className="size-4 text-ink-2" aria-hidden="true" />
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {name}
        </h2>
        <Link
          to="."
          search={(prev) => ({ ...prev, panel: "closed" })}
          aria-label="Close document"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "max-md:hidden"
          )}
        >
          <XIcon />
        </Link>
      </header>
      <div
        ref={panel}
        className="min-h-0 flex-1 overflow-y-auto px-4 pb-12 md:px-9"
      >
        <div className="mx-auto max-w-[552px] rounded-sm bg-sheet px-6 py-10 shadow-sheet md:px-13 md:py-12">
          <DocumentView
            document={document}
            editing={known ? editing : undefined}
            onEdit={edit}
            renderEditor={(key) => (
              <FieldEditor
                // A refused save opens a fresh editor with what was typed.
                key={`${key}${recovery ? "-refused" : ""}`}
                definition={definition}
                values={values}
                fieldKey={key}
                focus={editing}
                recovery={recovery}
                onSave={(change, inputs) => {
                  setRefused(null)
                  edit(undefined)
                  save({ fieldKey: key, change, inputs })
                }}
                onCancel={() => {
                  setRefused(null)
                  edit(undefined)
                }}
              />
            )}
          />
        </div>
      </div>
    </section>
  )
}
