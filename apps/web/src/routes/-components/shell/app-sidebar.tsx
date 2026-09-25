import { useQuery } from "@tanstack/react-query"
import { Link, useMatchRoute, useRouteContext } from "@tanstack/react-router"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { PlusIcon } from "lucide-react"

import { Logo, LogoMark } from "@/components/logo"
import type { Viewer } from "@/lib/session"

import { AccountMenu } from "./account-menu"
import { ThemeToggle } from "./theme-toggle"

// The left sidebar (spec §1 Layout). T22 adds search, date groups and draft
// actions; T23 the rest of the account menu.
export function AppSidebar({ viewer }: { viewer: Viewer }) {
  return (
    <Sidebar collapsible="icon" aria-label="Drafts">
      <SidebarHeader className="flex-row items-center justify-between">
        <Link
          to="/"
          aria-label="Parley home"
          className="flex h-8 items-center px-1.5 text-xl group-data-[collapsible=icon]:hidden"
        >
          <Logo />
        </Link>
        <Link
          to="/"
          aria-label="Parley home"
          className="hidden size-8 items-center justify-center group-data-[collapsible=icon]:flex"
        >
          <LogoMark className="size-5" />
        </Link>
        <SidebarTrigger className="group-data-[collapsible=icon]:hidden" />
      </SidebarHeader>

      <SidebarContent className="scroll-fade-y">
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="New draft" render={<Link to="/" />}>
                <PlusIcon />
                <span>New draft</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        {viewer && <DraftHistory />}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem className="hidden group-data-[collapsible=icon]:block">
            <SidebarTrigger />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <ThemeToggle />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <AccountMenu viewer={viewer} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function DraftHistory() {
  const { orpc } = useRouteContext({ from: "/_app" })
  const drafts = useQuery(orpc.drafts.list.queryOptions({ input: {} }))
  const matchRoute = useMatchRoute()

  if (drafts.data?.length === 0) return null
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Recent</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {drafts.data
            ? drafts.data.map((draft) => (
                <SidebarMenuItem key={draft.id}>
                  <SidebarMenuButton
                    isActive={Boolean(
                      matchRoute({
                        to: "/d/$draftId",
                        params: { draftId: draft.id },
                      })
                    )}
                    render={
                      <Link to="/d/$draftId" params={{ draftId: draft.id }} />
                    }
                  >
                    <span className="truncate">{draft.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))
            : Array.from({ length: 3 }, (_, index) => (
                <SidebarMenuItem key={index}>
                  <SidebarMenuSkeleton />
                </SidebarMenuItem>
              ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
