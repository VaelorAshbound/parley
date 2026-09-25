import { ORPCError } from "@orpc/client"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, notFound } from "@tanstack/react-router"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { z } from "zod"

import { readCookie } from "@/lib/cookies"
import { documentName } from "@/lib/documents"

import { DraftWorkspace } from "../-components/shell/draft-workspace"
import { defaultLayout, layoutCookie } from "../-components/shell/layout"

// Only the non-default states are in the URL, so links stay clean:
// /d/:id?panel=closed&tab=document&field=governingLaw (spec §5 Routing).
const searchSchema = z.object({
  panel: z.literal("closed").optional().catch(undefined),
  tab: z.literal("document").optional().catch(undefined),
  field: z.string().max(100).optional().catch(undefined),
})

const layoutSchema = z.object({
  chat: z.number().min(0).max(100),
  document: z.number().min(0).max(100),
})

export const Route = createFileRoute("/_app/d/$draftId")({
  validateSearch: searchSchema,
  params: {
    parse: ({ draftId }) => ({ draftId: z.uuid().parse(draftId) }),
    stringify: ({ draftId }) => ({ draftId }),
  },
  loader: async ({ context, params }) => {
    try {
      const input = { input: { id: params.draftId } }
      await Promise.all([
        context.queryClient.ensureQueryData(
          context.orpc.drafts.get.queryOptions(input)
        ),
        context.queryClient.ensureQueryData(
          context.orpc.chat.messages.queryOptions(input)
        ),
      ])
    } catch (error) {
      // Not yours, not there, or not signed in: all the same friendly 404.
      if (error instanceof ORPCError && error.status < 500) throw notFound()
      throw error
    }
    const saved = layoutSchema.safeParse(
      JSON.parse(readCookie(layoutCookie) ?? "null")
    )
    return { layout: saved.success ? saved.data : defaultLayout }
  },
  head: () => ({ meta: [{ title: "Draft · Parley" }] }),
  component: DraftPage,
  pendingComponent: DraftPending,
})

function DraftPage() {
  const { orpc } = Route.useRouteContext()
  const { draftId } = Route.useParams()
  const search = Route.useSearch()
  const { layout } = Route.useLoaderData()
  const { data: draft } = useSuspenseQuery(
    orpc.drafts.get.queryOptions({ input: { id: draftId } })
  )
  const { data: messages } = useSuspenseQuery(
    orpc.chat.messages.queryOptions({ input: { id: draftId } })
  )

  return (
    <DraftWorkspace
      title={draft.title}
      documentName={documentName(draft.documentId)}
      draft={draft}
      messages={messages}
      editing={search.field}
      panelOpen={search.panel !== "closed"}
      tab={search.tab ?? "chat"}
      layout={layout}
    />
  )
}

// The same frame as the page, so nothing moves when it arrives.
function DraftPending() {
  return (
    <div className="flex h-svh" aria-busy="true" aria-label="Loading draft">
      <div className="flex flex-1 flex-col gap-4 p-5">
        <Skeleton className="h-6 w-48" />
      </div>
      <div className="hidden w-[55%] bg-paper-deep p-9 md:block">
        <Skeleton className="mx-auto h-[70svh] max-w-[552px]" />
      </div>
    </div>
  )
}
