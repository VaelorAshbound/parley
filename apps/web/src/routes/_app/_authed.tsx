import { createFileRoute } from "@tanstack/react-router"

import { requireAccount } from "@/features/auth/require-account"

// Pages for accounts only (spec §5 Routing): guests and signed-out visitors
// sign in first and come back. A guard for the UI; every procedure checks
// the session itself.
export const Route = createFileRoute("/_app/_authed")({
  beforeLoad: requireAccount,
})
