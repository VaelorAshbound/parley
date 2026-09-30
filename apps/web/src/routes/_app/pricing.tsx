import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { z } from "zod"

import { Pricing } from "@/features/billing/pricing"

// Pricing and the way to Pro (T26, features/billing). Polar's checkout
// comes back here with `checkout_id`.
export const Route = createFileRoute("/_app/pricing")({
  validateSearch: z.object({ checkout_id: z.string().optional() }),
  head: () => ({ meta: [{ title: "Pricing · Parley" }] }),
  staticData: { footer: true },
  component: PricingPage,
})

function PricingPage() {
  const { viewer } = Route.useRouteContext()
  const { checkout_id } = Route.useSearch()
  // Polar also adds its customer portal token; kept in the address, it lands
  // in history and in copied links (PAR-43). Replaced, so Back has no copy.
  // checkout_id stays: a reload still waits for Pro.
  const navigate = useNavigate()
  useEffect(() => {
    if (
      new URL(window.location.href).searchParams.has("customer_session_token")
    )
      void navigate({ to: ".", search: { checkout_id }, replace: true })
  }, [checkout_id, navigate])
  return <Pricing viewer={viewer} checkoutId={checkout_id} />
}
