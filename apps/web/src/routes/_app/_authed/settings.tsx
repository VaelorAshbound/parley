import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { z } from "zod"

import { AppearanceCard } from "@/features/account/appearance-card"
import { DeleteAccountCard } from "@/features/account/delete-account-card"
import { EmailCard } from "@/features/account/email-card"
import { PasswordCard } from "@/features/account/password-card"
import { ProfileCard } from "@/features/account/profile-card"
import { SessionsCard } from "@/features/account/sessions-card"
import { authConfigQuery } from "@/features/auth/auth-config"

// Settings (spec §5 Auth, T23): name, email, password, signed-in devices,
// theme, and deleting the account. `?email=` and `?error=` come back from
// the links in the change-email emails.
export const Route = createFileRoute("/_app/_authed/settings")({
  validateSearch: z.object({
    email: z.email().optional().catch(undefined),
    error: z.string().max(64).optional().catch(undefined),
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(
        context.orpc.account.get.queryOptions()
      ),
      context.queryClient.ensureQueryData(
        context.orpc.account.sessions.queryOptions()
      ),
      // Turnstile's site key, for changing the email.
      context.queryClient.ensureQueryData(authConfigQuery),
    ]),
  head: () => ({ meta: [{ title: "Settings · Parley" }] }),
  component: Settings,
  pendingComponent: SettingsPending,
})

function Settings() {
  const { account, orpc } = Route.useRouteContext()
  const search = Route.useSearch()
  const { data: login } = useSuspenseQuery(orpc.account.get.queryOptions())

  return (
    <Page>
      <ProfileCard account={account} />
      <EmailCard
        account={account}
        linkEmail={search.email}
        linkError={search.error}
      />
      <PasswordCard account={login} />
      <SessionsCard />
      <AppearanceCard />
      <DeleteAccountCard account={login} />
    </Page>
  )
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <div className="flex h-14 items-center px-3 md:hidden">
        <SidebarTrigger />
      </div>
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-4 pb-16 md:px-6 md:pt-14">
        <h1 className="font-serif text-4xl leading-none font-normal tracking-[-0.03em]">
          Settings
        </h1>
        {children}
      </main>
    </div>
  )
}

/** The same cards, before the data is in (only after 1 s: pendingMs). */
function SettingsPending() {
  return (
    <Page>
      {[160, 200, 260, 180].map((height) => (
        <Skeleton
          key={height}
          className="w-full rounded-xl"
          style={{ height }}
        />
      ))}
    </Page>
  )
}
