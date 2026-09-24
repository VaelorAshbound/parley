import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import type { DocumentId } from "@workspace/documents"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import { Spinner } from "@workspace/ui/components/spinner"
import { ArrowRightIcon } from "lucide-react"
import { Temporal } from "temporal-polyfill"

import { signInGuest } from "@/lib/auth-client"
import { documentList } from "@/lib/documents"
import { viewerQuery } from "@/lib/session"

export const Route = createFileRoute("/_app/")({
  head: () => ({ meta: [{ title: "Parley" }] }),
  component: Home,
})

// The start page. T17 adds the reply box and example prompts, T37 the full
// landing design; for now you start by choosing an agreement.
function Home() {
  const { viewer, orpc } = Route.useRouteContext()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const start = useMutation({
    mutationFn: async (documentId: DocumentId) => {
      // The first action that needs a session makes a guest (spec §5 Auth).
      if (!viewer) {
        await signInGuest()
        await queryClient.invalidateQueries({ queryKey: viewerQuery.queryKey })
      }
      return orpc.drafts.create.call({
        documentId,
        // The user's own calendar day, for fields that default to today.
        today: Temporal.Now.plainDateISO().toString(),
      })
    },
    onSuccess: async (draft) => {
      queryClient.setQueryData(
        orpc.drafts.get.queryKey({ input: { id: draft.id } }),
        draft
      )
      await queryClient.invalidateQueries({ queryKey: orpc.drafts.key() })
      await navigate({ to: "/d/$draftId", params: { draftId: draft.id } })
    },
  })

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
          Pick an agreement to start. Parley fills it in beside your chat and
          explains each choice in plain words.
        </p>

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
                onClick={() => start.mutate(document.id)}
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
                  {start.isPending && start.variables === document.id ? (
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
