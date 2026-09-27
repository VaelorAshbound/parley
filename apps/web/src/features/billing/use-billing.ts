import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { useEffect } from "react"

import { authClient } from "@/lib/auth-client"
import { freshViewer, viewerQuery } from "@/lib/session"

import { billingProblem, type BillingProblem } from "./problem"

// Polar's checkout and billing portal (T26). Both answer with a URL that
// Better Auth's client opens at once, so a success means "leaving the page".

/**
 * Opens a Polar page. `pending` stays on while the browser leaves, and goes
 * off again when Back brings the page out of the back/forward cache.
 */
function usePolarPage(
  open: () => Promise<{ error: unknown }>,
  onProblem?: (problem: BillingProblem) => void
) {
  const page = useMutation({
    mutationFn: async () => {
      const { error } = await open()
      if (error) throw error
    },
    onError: (error) => onProblem?.(billingProblem(authErrorOf(error))),
  })
  const { reset } = page
  useEffect(() => {
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) reset()
    }
    window.addEventListener("pageshow", restored)
    return () => window.removeEventListener("pageshow", restored)
  }, [reset])
  return {
    open: () => page.mutate(),
    pending: page.isPending || page.isSuccess,
    problem: page.error ? billingProblem(authErrorOf(page.error)) : undefined,
  }
}

function authErrorOf(error: unknown) {
  const { code, status } = error as { code?: string; status?: number }
  return { code, status: status ?? 500 }
}

/** Polar's checkout for Pro. */
export function useCheckout() {
  return usePolarPage(() => authClient.checkout({ slug: "pro" }))
}

/** Polar's customer portal: the card, invoices, and canceling. */
export function usePortal(onProblem?: (problem: BillingProblem) => void) {
  return usePolarPage(
    // POST: the server refuses a GET, which a link on another site can make.
    () => authClient.customer.portal({ fetchOptions: { method: "POST" } }),
    onProblem
  )
}

/** How many times the page asks before it says it's still waiting (1 min). */
const TRIES = 30

/**
 * After Polar's checkout: waits for its webhook to turn Pro on, asking for
 * the session fresh from the database (the cookie cache may say Free for 5
 * more minutes). The answer also refreshes the viewer, so the plan badge
 * in the sidebar changes with the page.
 */
export function useUpgradeWait(checkoutId: string | undefined) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const queryKey = ["billing", "upgrade", checkoutId]
  const wait = useQuery({
    queryKey,
    queryFn: async () => {
      const viewer = await freshViewer()
      queryClient.setQueryData(viewerQuery.queryKey, viewer)
      // The sidebar reads the viewer from the route's context.
      if (viewer?.plan === "pro") await router.invalidate()
      return viewer
    },
    enabled: checkoutId !== undefined,
    refetchInterval: ({ state }) =>
      state.data?.plan === "pro" ||
      state.dataUpdateCount + state.errorUpdateCount >= TRIES
        ? false
        : 2000,
    // One answer per poll; a failed one is just the next poll.
    retry: false,
  })
  if (checkoutId === undefined) return undefined
  if (wait.data?.plan === "pro") return { state: "done" as const }
  // Read at each render, and each answer renders again.
  const state = queryClient.getQueryState(queryKey)
  if (state && state.dataUpdateCount + state.errorUpdateCount >= TRIES)
    return { state: "slow" as const, again: () => void wait.refetch() }
  return { state: "waiting" as const }
}
