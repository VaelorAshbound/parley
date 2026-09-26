import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Outlet } from "@tanstack/react-router"
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"

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
        <SidebarProvider defaultOpen={defaultOpen}>
          <AppSidebar viewer={viewer} orpc={orpc} calendarKey={calendar} />
          {/* min-w-0: a truncated row in the chat must not widen the page. */}
          <SidebarInset className="min-w-0">
            <Outlet />
          </SidebarInset>
        </SidebarProvider>
      </MotionConfig>
    </UiStoreProvider>
  )
}
