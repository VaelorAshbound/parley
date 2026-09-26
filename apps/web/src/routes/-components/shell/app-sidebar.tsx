import { Link } from "@tanstack/react-router"
import { Kbd } from "@workspace/ui/components/kbd"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import { PlusIcon, SearchIcon } from "lucide-react"
import {
  lazy,
  Suspense,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react"

import { Logo, LogoMark } from "@/components/logo"
import { DraftHistory } from "@/features/drafts/draft-history"
import type { Orpc } from "@/lib/orpc"
import type { Viewer } from "@/lib/session"

import { AccountMenu } from "./account-menu"
import { ThemeToggle } from "./theme-toggle"

// The search dialog (and cmdk under it) loads on first use, not with every
// page; hovering or focusing Search starts the download.
const loadSearch = () => import("@/features/drafts/search-dialog")
const SearchDialog = lazy(() =>
  loadSearch().then((module) => ({ default: module.SearchDialog }))
)

// The left sidebar (spec §1 Layout): search, New draft, the history by day,
// and the account. T23 adds the rest of the account menu.
export function AppSidebar({
  viewer,
  orpc,
  calendarKey,
}: {
  viewer: Viewer
  orpc: Orpc
  calendarKey: string
}) {
  // Search needs someone signed in (a guest counts); ⌘K stays the
  // browser's until then.
  const search = useSearchDialog(viewer !== null)
  const isAccount = viewer !== null && !viewer.isAnonymous

  return (
    <>
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
              {viewer && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Search"
                    aria-keyshortcuts="Meta+K Control+K"
                    onClick={() => search.setOpen(true)}
                    onPointerEnter={() => void loadSearch()}
                    onFocus={() => void loadSearch()}
                  >
                    <SearchIcon />
                    <span>Search</span>
                    <ShortcutHint />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="New draft" render={<Link to="/" />}>
                  <PlusIcon />
                  <span>New draft</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
          {viewer && (
            <DraftHistory
              orpc={orpc}
              calendarKey={calendarKey}
              isAccount={isAccount}
            />
          )}
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
      {/* Beside the sidebar, not in it: on a phone the sidebar is a drawer,
        and the search must open (and stay open) with the drawer closed. */}
      {viewer && search.used && (
        <Suspense fallback={null}>
          <SearchDialog
            open={search.open}
            onOpenChange={search.setOpen}
            orpc={orpc}
            calendarKey={calendarKey}
            showAll={isAccount}
          />
        </Suspense>
      )}
    </>
  )
}

/**
 * The search dialog's state, and ⌘K / Ctrl+K from anywhere in the shell.
 * Opening it closes the phone drawer, so a picked draft isn't hidden.
 */
function useSearchDialog(enabled: boolean) {
  const { setOpenMobile } = useSidebar()
  const [open, setOpen] = useState(false)
  // Loads the dialog's code only once someone searches.
  const [used, setUsed] = useState(false)
  useEffect(() => {
    if (!enabled) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k") return
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey)
        return
      event.preventDefault()
      setUsed(true)
      setOpenMobile(false)
      setOpen((current) => !current)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [enabled, setOpenMobile])
  return {
    open,
    used,
    setOpen: (next: boolean) => {
      if (next) {
        setUsed(true)
        setOpenMobile(false)
      }
      setOpen(next)
    },
  }
}

/** "⌘K" on a Mac, "Ctrl K" elsewhere; nothing until the page knows which. */
function ShortcutHint() {
  const keys = useSyncExternalStore(
    subscribeNever,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"),
    () => null
  )
  if (!keys) return null
  return (
    <Kbd aria-hidden="true" className="ml-auto max-md:hidden">
      {keys}
    </Kbd>
  )
}

function subscribeNever() {
  return () => {}
}
