import { Link, useLocation } from "@tanstack/react-router"
import { Badge } from "@workspace/ui/components/badge"
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
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import {
  CreditCardIcon,
  LogInIcon,
  LogOutIcon,
  SettingsIcon,
  SparklesIcon,
  UserRoundIcon,
} from "lucide-react"

import { reloadTo } from "@/features/auth/reload-to"
import { usePortal } from "@/features/billing/use-billing"
import { authClient } from "@/lib/auth-client"
import type { Viewer } from "@/lib/session"

const planNames = { free: "Free", pro: "Pro" } as const

// The sidebar's account row (spec §1 Layout). Guests are asked to sign in,
// which keeps their draft; accounts get their name, plan and a menu:
// Settings, Upgrade to Pro (Free), Billing (whoever Polar knows as a
// customer), and Sign out.
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
        <Badge variant="secondary" className="ml-auto">
          {planNames[viewer.plan]}
        </Badge>
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
          <DropdownMenuItem render={<Link to="/settings" />}>
            <SettingsIcon />
            Settings
          </DropdownMenuItem>
          {viewer.plan !== "pro" && (
            <DropdownMenuItem render={<Link to="/pricing" />}>
              <SparklesIcon />
              Upgrade to Pro
            </DropdownMenuItem>
          )}
          {/* Pro, or Pro once: the past invoices are in the portal (PAR-21). */}
          {viewer.hasBilling && <BillingItem />}
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

/**
 * Polar's billing portal (T26). The menu stays open with a spinner while
 * the portal's link is made, then the page goes there.
 */
function BillingItem() {
  const portal = usePortal((problem) =>
    toast.add({ title: "Billing didn’t open", description: problem.message })
  )
  return (
    <DropdownMenuItem
      closeOnClick={false}
      disabled={portal.pending}
      onClick={portal.open}
    >
      {portal.pending ? <Spinner /> : <CreditCardIcon />}
      Billing
    </DropdownMenuItem>
  )
}
