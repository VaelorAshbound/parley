import { redirect, type ParsedLocation } from "@tanstack/react-router"

import type { Viewer } from "@/lib/session"

/**
 * The `_app/_authed` guard (spec §5 Routing): guests and signed-out visitors
 * go to sign-in and come back after. For the UI only; every procedure
 * checks the session itself ("a route guard is not a data authorization
 * boundary"). Pages below it get the signed-up viewer as `account`.
 */
export function requireAccount({
  context,
  location,
}: {
  context: { viewer: Viewer }
  location: ParsedLocation
}) {
  const viewer = context.viewer
  if (!viewer || viewer.isAnonymous)
    throw redirect({ to: "/sign-in", search: { redirect: location.href } })
  return { account: viewer }
}
