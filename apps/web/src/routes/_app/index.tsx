import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { italicPreload } from "@workspace/ui/lib/fonts"
import { Temporal } from "temporal-polyfill"

import { ProblemNote } from "@/components/problem-note"
import { authConfigQuery } from "@/features/auth/auth-config"
import { useTurnstile } from "@/features/auth/turnstile"
import { startProblem } from "@/features/drafts/start-problem"
import { Landing, type Start } from "@/features/empty-state/landing"
import { signInGuest } from "@/lib/auth-client"
import { viewerQuery } from "@/lib/session"
import { useUiStore } from "@/lib/ui-store"

export const Route = createFileRoute("/_app/")({
  head: () => ({ meta: [{ title: "Parley" }], links: [italicPreload] }),
  // The Turnstile site key, for the first visit's guest (spec §2 Limits).
  loader: ({ context }) => context.queryClient.ensureQueryData(authConfigQuery),
  component: Home,
})

// The start page: describe the deal, or pick an agreement
// (features/empty-state).

function Home() {
  const { viewer, orpc } = Route.useRouteContext()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data: config } = useSuspenseQuery(authConfigQuery)
  const turnstile = useTurnstile(config.turnstileSiteKey)

  const setPending = useUiStore((state) => state.setPending)
  const start = useMutation({
    // A draft from an agreement picked in the list, or from a first message:
    // then the chat picks the agreement (T17).
    mutationFn: async (from: Start) => {
      // The first action that needs a session makes a guest (spec §5 Auth),
      // after a Turnstile check (spec §2 Limits).
      if (!viewer) {
        await signInGuest(() => turnstile.headers())
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

  return (
    <Landing
      isAccount={viewer !== null && !viewer.isAnonymous}
      busy={start.isPending}
      picking={
        start.isPending && "documentId" in start.variables
          ? start.variables.documentId
          : undefined
      }
      onStart={(from) => start.mutate(from)}
      // Shows only when Cloudflare wants a click.
      turnstile={!viewer && turnstile.widget}
      problem={
        start.isError && (
          <ProblemNote problem={startProblem(start.error)} className="mt-4" />
        )
      }
    />
  )
}
