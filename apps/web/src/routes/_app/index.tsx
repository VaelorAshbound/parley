import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import type { DocumentId } from "@workspace/documents"
import { Button } from "@workspace/ui/components/button"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import { Spinner } from "@workspace/ui/components/spinner"
import { ArrowRightIcon } from "lucide-react"
import { Temporal } from "temporal-polyfill"

import { Composer } from "@/features/chat/composer"
import { signInGuest } from "@/lib/auth-client"
import { documentList } from "@/lib/documents"
import { viewerQuery } from "@/lib/session"
import { useUiStore } from "@/lib/ui-store"

export const Route = createFileRoute("/_app/")({
  head: () => ({ meta: [{ title: "Parley" }] }),
  component: Home,
})

// The start page: describe the deal, or pick an agreement. T37 adds the full
// landing design.

/** First messages that show what Parley does (brand.md canvas). */
const examples = [
  "We’re sharing our product roadmap with a supplier.",
  "A 60-day paid pilot of our software.",
  "Beta access for a design partner, in exchange for feedback.",
  "We’re hiring an agency for a website project.",
]
function Home() {
  const { viewer, orpc } = Route.useRouteContext()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const setPending = useUiStore((state) => state.setPending)
  const start = useMutation({
    // A draft from an agreement picked in the list, or from a first message:
    // then the chat picks the agreement (T17).
    mutationFn: async (from: { documentId: DocumentId } | { text: string }) => {
      // The first action that needs a session makes a guest (spec §5 Auth).
      if (!viewer) {
        await signInGuest()
        await queryClient.invalidateQueries({ queryKey: viewerQuery.queryKey })
      }
      return orpc.drafts.create.call({
        ...("documentId" in from && { documentId: from.documentId }),
        // The user's own calendar day, for fields that default to today.
        today: Temporal.Now.plainDateISO().toString(),
      })
    },
    onSuccess: async (draft, from) => {
      queryClient.setQueryData(
        orpc.drafts.get.queryKey({ input: { id: draft.id } }),
        draft
      )
      queryClient.setQueryData(
        orpc.chat.messages.queryKey({ input: { id: draft.id } }),
        []
      )
      if ("text" in from) setPending({ draftId: draft.id, text: from.text })
      await queryClient.invalidateQueries({ queryKey: orpc.drafts.key() })
      await navigate({ to: "/d/$draftId", params: { draftId: draft.id } })
    },
  })
  const picking = (id: DocumentId) =>
    start.isPending &&
    "documentId" in start.variables &&
    start.variables.documentId === id

  return (
    <div className="flex min-h-svh flex-col">
      <div className="flex h-14 items-center px-3 md:hidden">
        <SidebarTrigger />
      </div>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12 md:py-20">
        <h1 className="font-serif text-4xl leading-none font-normal tracking-[-0.03em] text-balance md:text-6xl">
          Describe the deal. Watch the contract{" "}
          <em className="text-blue-ink">fill itself in.</em>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-ink-2">
          Tell Parley about your deal. It picks the agreement, fills it in
          beside your chat and explains each choice in plain words.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Composer
            busy={start.isPending}
            placeholder="We’re sharing our roadmap with a supplier…"
            onSend={(text) => start.mutate({ text })}
          />
          <ul aria-label="Examples" className="flex flex-wrap gap-2">
            {examples.map((example) => (
              <li key={example}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full font-normal text-ink-2"
                  disabled={start.isPending}
                  onClick={() => start.mutate({ text: example })}
                >
                  {example}
                </Button>
              </li>
            ))}
          </ul>
        </div>

        <h2
          id="library"
          className="mt-14 text-label text-muted-foreground uppercase"
        >
          The library
        </h2>
        <ol
          aria-labelledby="library"
          className="mt-3 grid gap-x-10 md:grid-cols-2"
        >
          {documentList.map((document, index) => (
            <li key={document.id} className="border-t">
              <button
                type="button"
                disabled={start.isPending}
                onClick={() => start.mutate({ documentId: document.id })}
                className="group grid w-full grid-cols-[2.5rem_1fr_auto] items-start gap-y-1 py-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
              >
                <span className="font-serif text-[15px] text-muted-foreground italic tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="flex flex-col gap-1">
                  <span className="font-serif text-xl leading-snug font-medium tracking-[-0.01em]">
                    {document.name}
                  </span>
                  <span className="text-[13.5px] text-ink-2">
                    {document.description}
                  </span>
                </span>
                <span className="self-center text-muted-foreground transition-transform group-hover:translate-x-0.5">
                  {picking(document.id) ? (
                    <Spinner />
                  ) : (
                    <ArrowRightIcon className="size-4" aria-hidden="true" />
                  )}
                </span>
              </button>
            </li>
          ))}
        </ol>
        {start.isError && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            We couldn’t start that draft. Please try again.
          </p>
        )}

        <p className="mt-12 text-[12.5px] text-muted-foreground">
          Standard agreements by Common Paper, used under CC BY 4.0. Parley is a
          demo: not legal advice, and not for real agreements.
        </p>
      </main>
    </div>
  )
}
