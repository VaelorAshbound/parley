import { ORPCError } from "@orpc/client"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, notFound } from "@tanstack/react-router"

import { SharePage, ShareNotFound } from "@/features/share/share-page"
import { sharePageHeaders } from "@/features/share/headers"

// /s/:token, a draft shared read-only (spec §5 Routing; T25). Public and
// outside the app shell: no session is read, so a visitor gets no guest.

export const Route = createFileRoute("/s/$token")({
  loader: async ({ context, params }) => {
    try {
      const shared = await context.queryClient.ensureQueryData(
        context.orpc.share.view.queryOptions({
          input: { token: params.token },
        })
      )
      return { title: shared.title }
    } catch (error) {
      // Turned off, unknown or not a token: all the same friendly 404.
      if (error instanceof ORPCError && error.status < 500) throw notFound()
      throw error
    }
  },
  // Also on the 404: no shared cache keeps the page after the link is
  // turned off, and search engines never list it.
  headers: () => sharePageHeaders,
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData ? `${loaderData.title} · Parley` : "Parley",
      },
      { name: "robots", content: "noindex, nofollow" },
      // Links out of the page never carry the token (Referer).
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: SharedDraft,
  notFoundComponent: ShareNotFound,
})

function SharedDraft() {
  const { orpc } = Route.useRouteContext()
  const { token } = Route.useParams()
  const { data } = useSuspenseQuery(
    orpc.share.view.queryOptions({ input: { token } })
  )
  return <SharePage shared={data} />
}
