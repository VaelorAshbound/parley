import { createFileRoute, Outlet } from "@tanstack/react-router"

import { requireAccount } from "@/features/auth/require-account"

// Pages for signed-up accounts (spec §5 Routing): guests and signed-out
// visitors go to sign-in and come back after. For the UI only; every
// procedure checks the session itself.
export const Route = createFileRoute("/_app/_authed")({
  beforeLoad: requireAccount,
  component: Outlet,
})
