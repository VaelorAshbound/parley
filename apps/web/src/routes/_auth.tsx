import { createFileRoute, Link, Outlet } from "@tanstack/react-router"

import { Logo } from "@/components/logo"
import { authConfigQuery } from "@/features/auth/auth-config"
import { viewerQuery } from "@/lib/session"

// The sign-in, sign-up and confirm-email pages, outside the app shell
// (spec §5 Routing). The viewer and the auth config are read on the server,
// so the page renders complete, with no flash.
export const Route = createFileRoute("/_auth")({
  beforeLoad: async ({ context }) => ({
    // fetchQuery, not ensureQueryData: once a new guest or a sign-in marks
    // the viewer stale, ensureQueryData would still hand back the old one.
    viewer: await context.queryClient.fetchQuery(viewerQuery),
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(authConfigQuery),
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <div className="flex min-h-svh flex-col items-center px-4 py-10 md:justify-center">
      <Link
        to="/"
        aria-label="Parley home"
        className="mb-8 rounded-md text-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Logo />
      </Link>
      <main className="w-full max-w-sm">
        <Outlet />
      </main>
      <p className="mt-10 max-w-sm text-center text-[12.5px] text-muted-foreground">
        Parley is a demo: not legal advice, and not for real agreements.
      </p>
    </div>
  )
}
