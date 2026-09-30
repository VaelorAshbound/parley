import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { z } from "zod"

import { AppearanceCard } from "@/features/account/appearance-card"
import { DeleteAccountCard } from "@/features/account/delete-account-card"
import { EmailCard } from "@/features/account/email-card"
import { PasswordCard } from "@/features/account/password-card"
import { ProfileCard } from "@/features/account/profile-card"
import { SessionsCard } from "@/features/account/sessions-card"
import { TwoFactorCard } from "@/features/account/two-factor/two-factor-card"
import { authConfigQuery } from "@/features/auth/auth-config"

// Settings (spec §5 Auth, T23): name, email, password, two-factor sign-in
// (T23b), signed-in devices, theme, and deleting the account. `?email=` and
// `?error=` come back from the links in the change-email emails.
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
      <TwoFactorCard account={login} />
      <SessionsCard />
      <AppearanceCard />
      <DeleteAccountCard account={login} />
    </Page>
  )
}

/**
 * The page and its cards in Paper & Ink, like the start and pricing pages
 * (PAR-45): the title at the brand's Title size, each card's title in
 * Newsreader, and even, roomier padding. The cards are shadcn's; their look
 * is set here, once, for all of them. One ink button on the page: turning
 * on two-factor. Saves are outline buttons (SubmitRow).
 */
function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <div className="flex h-14 items-center px-3 md:hidden">
        <SidebarTrigger />
      </div>
      <div
        className={cn(
          "mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-4 pb-20 md:gap-8 md:px-6 md:pt-16",
          "[&_[data-slot=card]]:rounded-2xl [&_[data-slot=card]]:[--card-spacing:--spacing(6)] sm:[&_[data-slot=card]]:[--card-spacing:--spacing(8)]",
          "[&_[data-slot=card-header]]:gap-1.5 [&_[data-slot=card-title]]:font-serif [&_[data-slot=card-title]]:text-[1.625rem] [&_[data-slot=card-title]]:leading-[1.15] [&_[data-slot=card-title]]:font-normal [&_[data-slot=card-title]]:tracking-[-0.015em]",
          "[&_[data-slot=card-description]]:text-[15px] [&_[data-slot=card-description]]:leading-relaxed"
        )}
      >
        <h1 className="mb-2 font-serif text-title-sm sm:text-title">
          Settings
        </h1>
        {children}
      </div>
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
          className="w-full rounded-2xl"
          style={{ height }}
        />
      ))}
    </Page>
  )
}
