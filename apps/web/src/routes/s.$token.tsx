import { ORPCError } from "@orpc/client"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, notFound } from "@tanstack/react-router"
import { createIsomorphicFn } from "@tanstack/react-start"
import { setResponseHeader } from "@tanstack/react-start/server"

import {
  SharePage,
  ShareLimited,
  ShareNotFound,
} from "@/features/share/share-page"
import { sharePageHeaders } from "@/features/share/headers"
import { sharedDraftQuery } from "@/features/share/shared-query"
import { RATE_LIMITS } from "@/server/limits"

import { showsNotFound } from "./-components/states"

// /s/:token, a draft shared read-only (spec §5 Routing; T25). Public and
// outside the app shell: no session is read, so a visitor gets no guest.

/**
 * A page past the share limit says when to come back (PAR-13). Start can't
 * send a 429 itself; withPageHeaders turns a page with Retry-After into one.
 * On a client-side visit the browser already had the API's 429.
 */
const answerTooManyViews = createIsomorphicFn()
  .server(() => {
    setResponseHeader(
      "Retry-After",
      String(RATE_LIMITS.SHARE_RATE_LIMITER.period)
    )
  })
  .client(() => {})

export const Route = createFileRoute("/s/$token")({
  loader: async ({ context, params }) => {
    try {
      const shared = await context.queryClient.ensureQueryData(
        sharedDraftQuery(context.orpc, params.token)
      )
      return { limited: false as const, title: shared.title }
    } catch (error) {
      if (!(error instanceof ORPCError)) throw error
      // Too many views from this address (PAR-13): the link may be fine, so
      // never "not found".
      if (error.code === "TOO_MANY_REQUESTS") {
        answerTooManyViews()
        return { limited: true as const }
      }
      // Turned off, unknown or not a token: all the same friendly 404.
      if (error.status < 500) throw notFound()
      throw error
    }
  },
  // Also on the 404: no shared cache keeps the page after the link is
  // turned off, and search engines never list it.
  headers: () => sharePageHeaders,
  head: ({ loaderData, match }) => ({
    meta: [
      {
        title: showsNotFound(match)
          ? "Link not found · Parley"
          : loaderData?.limited
            ? "Give it a minute · Parley"
            : loaderData
              ? `${loaderData.title} · Parley`
              : "Parley",
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
  const { limited } = Route.useLoaderData()
  return limited ? <ShareLimited /> : <SharedDocument />
}

function SharedDocument() {
  const { orpc } = Route.useRouteContext()
  const { token } = Route.useParams()
  const { data } = useSuspenseQuery(sharedDraftQuery(orpc, token))
  return <SharePage shared={data} />
}
