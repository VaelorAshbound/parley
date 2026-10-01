import { revalidateLogic } from "@tanstack/react-form"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { FieldGroup } from "@workspace/ui/components/field"
import { CopyIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { useState, type ReactElement, type ReactNode } from "react"
import { z } from "zod"

import { draftTitle } from "@/lib/drafts"
import { useAppForm } from "@/lib/form"
import type { Orpc } from "@/lib/orpc"

import { useDraftActions, type DraftRef } from "./use-draft-actions"

/**
 * A draft's menu: rename, duplicate and delete (spec §1 Layout). `render` is
 * the trigger (the sidebar row's "…", the title), `children` its content.
 * Guests can't duplicate: they have one draft (spec §2 Limits).
 */
export function DraftMenu({
  draft,
  orpc,
  canDuplicate,
  render,
  label,
  align = "start",
  children,
}: {
  draft: DraftRef
  orpc: Orpc
  canDuplicate: boolean
  render: ReactElement
  /** The trigger's name for screen readers, when its content has none. */
  label?: string
  align?: "start" | "end"
  children?: ReactNode
}) {
  const [renaming, setRenaming] = useState(false)
  const actions = useDraftActions(orpc)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={render} aria-label={label}>
          {children}
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="min-w-40">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setRenaming(true)}>
              <PencilIcon />
              Rename
            </DropdownMenuItem>
            {canDuplicate && (
              <DropdownMenuItem onClick={() => void actions.duplicate(draft)}>
                <CopyIcon />
                Duplicate
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => actions.remove(draft)}
            >
              <Trash2Icon />
              Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename draft</DialogTitle>
          </DialogHeader>
          <RenameForm
            title={draft.title}
            onDone={(title) => {
              setRenaming(false)
              if (title !== draft.title) void actions.rename(draft, title)
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

const renameSchema = z.object({ title: draftTitle })

function RenameForm({
  title,
  onDone,
}: {
  title: string
  onDone: (title: string) => void
}) {
  const form = useAppForm({
    defaultValues: { title },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: renameSchema },
    // The new name shows everywhere at once; the save follows.
    onSubmit: ({ value }) => onDone(value.title.trim()),
  })

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <FieldGroup>
        <form.AppField name="title">
          {(field) => <field.TextField label="Name" selectOnFocus />}
        </form.AppField>
      </FieldGroup>
      <DialogFooter className="mt-6">
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancel
        </DialogClose>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  )
}
