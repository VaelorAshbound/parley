import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Outlet, useMatches } from "@tanstack/react-router"
import { SidebarProvider } from "@workspace/ui/components/sidebar"

import { SiteFooter } from "@/components/site"

import {
  readTimeZone,
  timeZoneCookie,
  todayKey,
} from "@/features/drafts/calendar"
import { readCookie } from "@/lib/cookies"
import { viewerQuery } from "@/lib/session"
import { UiStoreProvider } from "@/lib/ui-store"
import { MotionConfig } from "motion/react"

import { AppSidebar } from "./-components/shell/app-sidebar"

// The three-pane shell around / and /d/$draftId (spec §5 Routing). Guards
// here are for the UI only; every procedure checks the session itself.
export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context }) => ({
    // fetchQuery, not ensureQueryData: once a new guest or a sign-in marks
    // the viewer stale, ensureQueryData would still hand back the old one.
    viewer: await context.queryClient.fetchQuery(viewerQuery),
  }),
  loader: async ({ context }) => {
    if (context.viewer)
      await context.queryClient.ensureQueryData(
        context.orpc.drafts.list.queryOptions({ input: {} })
      )
    return {
      // shadcn's Sidebar saves open/closed here; read on the server so the
      // first paint is already right.
      sidebarCookie: readCookie("sidebar_state"),
      // The history's days in the user's time zone, which the browser saved
      // (UTC until it has): the server groups drafts as the browser will.
      calendar: todayKey(readTimeZone(readCookie(timeZoneCookie))),
    }
  },
  component: AppLayout,
})

function AppLayout() {
  const { viewer, orpc } = Route.useRouteContext()
  const { sidebarCookie, calendar } = Route.useLoaderData()
  // The start page and pricing end with the site footer (staticData.footer).
  const footer = useMatches({
    select: (matches) => matches.some((match) => match.staticData.footer),
  })
  const drafts = useQuery({
    ...orpc.drafts.list.queryOptions({ input: {} }),
    enabled: viewer !== null,
  })
  // Until someone chooses, a guest with no drafts sees a slim rail.
  const defaultOpen =
    sidebarCookie === undefined
      ? (drafts.data?.length ?? 0) > 0
      : sidebarCookie === "true"

  return (
    <UiStoreProvider>
      {/* Motion follows the system's reduced-motion setting everywhere. */}
      <MotionConfig reducedMotion="user">
        {/* The first Tab: past the sidebar's history, straight to the page
            (WCAG 2.4.1). Focus moves without changing the URL. */}
        <a
          href="#content"
          onClick={(event) => {
            event.preventDefault()
            document.getElementById("content")?.focus()
          }}
          className="sr-only rounded-full bg-card text-sm font-medium shadow-float focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        <SidebarProvider defaultOpen={defaultOpen}>
          <AppSidebar viewer={viewer} orpc={orpc} calendarKey={calendar} />
          {/* shadcn's SidebarInset, but a div: the page is the main
              landmark and the site footer comes after it, so it is the
              contentinfo landmark (PAR-22). min-w-0: a truncated row in the
              chat must not widen the page. */}
          <div
            data-slot="sidebar-inset"
            className="relative flex w-full min-w-0 flex-1 flex-col bg-background"
          >
            <main
              id="content"
              tabIndex={-1}
              className="flex flex-1 flex-col outline-none"
            >
              <Outlet />
            </main>
            {footer && (
              <div className="@container">
                <div className="px-6 pb-10 md:px-12 @min-[84rem]:pr-14 @min-[84rem]:pl-23">
                  <SiteFooter
                    isAccount={viewer !== null && !viewer.isAnonymous}
                  />
                </div>
              </div>
            )}
          </div>
        </SidebarProvider>
      </MotionConfig>
    </UiStoreProvider>
  )
}
