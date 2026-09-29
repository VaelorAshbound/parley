import { createFileRoute } from "@tanstack/react-router"
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
  return <Pricing viewer={viewer} checkoutId={checkout_id} />
}
