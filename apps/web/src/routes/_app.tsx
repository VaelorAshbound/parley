import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Outlet } from "@tanstack/react-router"
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"

import { readCookie } from "@/lib/cookies"
import { viewerQuery } from "@/lib/session"
import { UiStoreProvider } from "@/lib/ui-store"

import { AppSidebar } from "./-components/shell/app-sidebar"

// The three-pane shell around / and /d/$draftId (spec §5 Routing). Guards
// here are for the UI only; every procedure checks the session itself.
export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context }) => ({
    viewer: await context.queryClient.ensureQueryData(viewerQuery),
  }),
  loader: async ({ context }) => {
    if (context.viewer)
      await context.queryClient.ensureQueryData(
        context.orpc.drafts.list.queryOptions({ input: {} })
      )
    // shadcn's Sidebar saves open/closed here; read on the server so the
    // first paint is already right.
    return { sidebarCookie: readCookie("sidebar_state") }
  },
  component: AppLayout,
})

function AppLayout() {
  const { viewer, orpc } = Route.useRouteContext()
  const { sidebarCookie } = Route.useLoaderData()
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
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar viewer={viewer} />
        <SidebarInset>
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </UiStoreProvider>
  )
}
