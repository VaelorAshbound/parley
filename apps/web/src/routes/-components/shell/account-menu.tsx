import { Link, useLocation } from "@tanstack/react-router"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { SidebarMenuButton } from "@workspace/ui/components/sidebar"
import { LogInIcon, LogOutIcon, UserRoundIcon } from "lucide-react"

import { reloadTo } from "@/features/auth/reload-to"
import { authClient } from "@/lib/auth-client"
import type { Viewer } from "@/lib/session"

// The sidebar's account row. Guests are asked to sign in, which keeps their
// draft; accounts get a menu with sign-out. T23 adds settings and billing.
export function AccountMenu({ viewer }: { viewer: Viewer }) {
  const location = useLocation()

  if (!viewer || viewer.isAnonymous)
    return (
      <SidebarMenuButton
        tooltip="Sign in"
        render={<Link to="/sign-in" search={{ redirect: location.href }} />}
      >
        <LogInIcon />
        <span>Sign in to save</span>
      </SidebarMenuButton>
    )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<SidebarMenuButton tooltip={viewer.name} />}>
        <UserRoundIcon />
        <span className="truncate">{viewer.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col">
            <span className="truncate text-foreground">{viewer.name}</span>
            <span className="truncate font-normal">{viewer.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={async () => {
              await authClient.signOut()
              reloadTo("/")
            }}
          >
            <LogOutIcon />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
