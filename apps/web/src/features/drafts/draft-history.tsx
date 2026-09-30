import { useQuery } from "@tanstack/react-query"
import { Link, useMatchRoute } from "@tanstack/react-router"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@workspace/ui/components/sidebar"
import { ArrowRightIcon, MoreHorizontalIcon } from "lucide-react"

import type { Orpc } from "@/lib/orpc"
import { useUiStore } from "@/lib/ui-store"

import { groupByDay } from "./calendar"
import { DraftMenu } from "./draft-menu"
import { useCalendar } from "./use-calendar"

/**
 * The sidebar's history: the latest drafts under Today, Yesterday, Last 7
 * days and Older, each with its menu; accounts get "View all" (/drafts).
 */
export function DraftHistory({
  orpc,
  calendarKey,
  isAccount,
}: {
  orpc: Orpc
  calendarKey: string
  isAccount: boolean
}) {
  const drafts = useQuery(orpc.drafts.list.queryOptions({ input: {} }))
  const hidden = useUiStore((state) => state.hidden)
  const calendar = useCalendar(calendarKey)
  const matchRoute = useMatchRoute()

  if (!drafts.data)
    return (
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarMenu aria-busy="true" aria-label="Loading drafts">
          {Array.from({ length: 3 }, (_, index) => (
            <SidebarMenuItem key={index}>
              <SidebarMenuSkeleton />
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>
    )

  const shown = drafts.data.filter((draft) => !hidden[draft.id])
  if (shown.length === 0) return null
  return (
    <>
      {groupByDay(shown, calendar).map((group) => (
        <SidebarGroup
          key={group.label}
          className="group-data-[collapsible=icon]:hidden"
        >
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu aria-label={group.label}>
              {group.drafts.map((draft) => (
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
                  <DraftMenu
                    draft={draft}
                    orpc={orpc}
                    canDuplicate={isAccount}
                    render={<SidebarMenuAction showOnHover />}
                    label={`More for ${draft.title}`}
                  >
                    <MoreHorizontalIcon />
                  </DraftMenu>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
      {isAccount && (
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="sm" render={<Link to="/drafts" />}>
                <span>View all</span>
                <ArrowRightIcon />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      )}
    </>
  )
}
