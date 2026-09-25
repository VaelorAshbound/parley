import { Link, useNavigate, useRouteContext } from "@tanstack/react-router"
import {
  definitionOf,
  render,
  type DocumentDefinition,
  type DocumentId,
} from "@workspace/documents"
import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { FileTextIcon, XIcon } from "lucide-react"
import { useIsMutating } from "@tanstack/react-query"
import { useDeferredValue, useEffect, useRef, type RefObject } from "react"

import { ChooseDocument } from "@/features/document-preview/choose-document"
import { DownloadMenu, DownloadProblem } from "@/features/export/download"
import { useDownload } from "@/features/export/use-download"
import { DocumentView } from "@/features/document-preview/document-view"
import { FieldEditor } from "@/features/field-editor/field-editor"
import { useSaveField } from "@/features/field-editor/use-save-field"
import { ShareMenu } from "@/features/share/share-menu"
import type { Orpc } from "@/lib/orpc"
import { useUiStore } from "@/lib/ui-store"

// The right panel (spec §1 Layout): the live document, where any value can be
// clicked and edited in place. The field being edited is in the URL
// (`?field=party1.email`), so a reload or a shared link opens the same
// editor. The header has Share (T25) and Download (T24).

type Draft = {
  id: string
  documentId: DocumentId | null
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
  const panel = useRef<HTMLDivElement>(null)
  const download = useDownload(orpc, draft.id)

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
        <SaveStatus />
        {draft.documentId !== null && (
          <>
            <ShareMenu orpc={orpc} draftId={draft.id} />
            <DownloadMenu download={download} />
          </>
        )}
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
      {/* Over the document, not above it: the page doesn't move. */}
      <div className="relative">
        <div className="absolute inset-x-4 top-0 z-10 md:inset-x-9">
          <DownloadProblem
            download={download}
            className="mx-auto max-w-[552px] shadow-md"
          />
        </div>
      </div>
      <div
        ref={panel}
        className="min-h-0 flex-1 scroll-fade-y overflow-y-auto px-4 pb-12 md:px-9"
      >
        <div className="mx-auto max-w-[552px] rounded-sm bg-sheet px-6 py-10 shadow-sheet md:px-13 md:py-12">
          {draft.documentId === null ? (
            <ChooseDocument orpc={orpc} draftId={draft.id} />
          ) : (
            <LiveDocument
              orpc={orpc}
              draftId={draft.id}
              definition={definitionOf(draft.documentId)}
              fields={draft.fields}
              editing={editing}
              panel={panel}
            />
          )}
        </div>
      </div>
    </section>
  )
}

/** The document, where any value can be clicked and edited in place. */
function LiveDocument({
  orpc,
  draftId,
  definition,
  fields,
  editing,
  panel,
}: {
  orpc: Orpc
  draftId: string
  definition: DocumentDefinition
  fields: Record<string, unknown>
  editing: string | undefined
  panel: RefObject<HTMLDivElement | null>
}) {
  const navigate = useNavigate()
  const save = useSaveField(orpc, draftId)
  const refused = useUiStore((state) => state.refused)
  const setRefused = useUiStore((state) => state.setRefused)
  const changed = useUiStore((state) => state.changed)
  const focus = useUiStore((state) => state.focus)
  // A change (or a newly picked agreement) is drawn from a deferred copy of
  // the fields, in time slices, so it never blocks the chat's streaming
  // (T18: no long tasks while the AI answers).
  const shownFields = useDeferredValue(fields)
  // Stored values are checked on the way in: a draft is only ever shown in
  // the shape its document defines.
  const values = definition.draftSchema.parse(shownFields)
  const document = render(definition, values)
  const editingKey = editing?.split(".")[0]
  const known = editingKey !== undefined && editingKey in definition.fields
  const recovery =
    refused?.draftId === draftId && refused.fieldKey === editingKey
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
  }, [known, editing, panel])

  // The panel follows the AI: it scrolls smoothly to the first field of each
  // change, unless the user is editing (brand.md: no motion if reduced).
  useEffect(() => {
    if (!focus || known) return
    const row = panel.current?.querySelector<HTMLElement>(
      `[data-section="${CSS.escape(focus.field)}"], [data-edit^="${CSS.escape(focus.field)}"]`
    )
    const view = panel.current?.getBoundingClientRect()
    if (!row || !view) return
    const box = row.getBoundingClientRect()
    // Already in full view: nothing to move.
    if (box.top >= view.top && box.bottom <= view.bottom) return
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches
    row.scrollIntoView({
      block: "center",
      behavior: still ? "instant" : "smooth",
    })
    // Only a new change scrolls, not an edit that ends.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [focus])

  return (
    <DocumentView
      document={document}
      changed={changed}
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
  )
}

/**
 * "Saving…" while edits are on their way. Leaving the page then asks first,
 * so a reload can't drop a save still waiting its turn.
 */
function SaveStatus() {
  const { orpc } = useRouteContext({ from: "/_app/d/$draftId" })
  const saving =
    useIsMutating({ mutationKey: orpc.drafts.updateFields.mutationKey() }) > 0
  useEffect(() => {
    if (!saving) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [saving])
  return (
    // <output> is a live status region: screen readers hear "Saving…".
    <output className="shimmer text-xs text-muted-foreground">
      {saving ? "Saving…" : ""}
    </output>
  )
}
