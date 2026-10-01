import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { DocumentId } from "@workspace/documents"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import { Spinner } from "@workspace/ui/components/spinner"
import { Temporal } from "temporal-polyfill"

import { documentList } from "@/lib/documents"
import type { Orpc } from "@/lib/orpc"

// The document panel before the chat has picked an agreement (T17): say so,
// and let the user pick one here instead.

export function ChooseDocument({
  orpc,
  draftId,
}: {
  orpc: Orpc
  draftId: string
}) {
  const queryClient = useQueryClient()
  const choose = useMutation({
    ...orpc.drafts.chooseDocument.mutationOptions(),
    onSuccess: (draft) => {
      queryClient.setQueryData(
        orpc.drafts.get.queryKey({ input: { id: draftId } }),
        draft
      )
      void queryClient.invalidateQueries({ queryKey: orpc.drafts.list.key() })
    },
  })
  const pick = (documentId: DocumentId) =>
    choose.mutate({
      id: draftId,
      documentId,
      today: Temporal.Now.plainDateISO().toString(),
    })

  return (
    <Empty className="p-0">
      <EmptyHeader>
        <EmptyTitle className="font-serif text-xl font-medium">
          No agreement yet
        </EmptyTitle>
        <EmptyDescription>
          Tell Parley about your deal in the chat, and it picks one. Or pick it
          yourself:
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="max-w-none">
        <ul aria-label="Agreements" className="flex w-full flex-col text-left">
          {documentList.map((document) => (
            <li key={document.id} className="border-t border-rule-sheet">
              <button
                type="button"
                disabled={choose.isPending}
                onClick={() => pick(document.id)}
                className="flex w-full items-center gap-3 py-3 text-left outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-serif text-base font-medium">
                    {document.name}
                  </span>
                  <span className="text-xs text-ink-2">
                    {document.description}
                  </span>
                </span>
                {choose.isPending &&
                  choose.variables.documentId === document.id && <Spinner />}
              </button>
            </li>
          ))}
        </ul>
        {choose.isError && (
          <p role="alert" className="text-sm text-destructive">
            We couldn’t pick that agreement. Please try again.
          </p>
        )}
      </EmptyContent>
    </Empty>
  )
}
