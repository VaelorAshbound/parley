import { redirect, type ParsedLocation } from "@tanstack/react-router"

import type { Viewer } from "@/lib/session"

/**
 * The `_app/_authed` guard (spec §5 Routing): guests and signed-out visitors
 * go to sign-in and come back after. For the UI only; every procedure
 * checks the session itself ("a route guard is not a data authorization
 * boundary"). T22 adds the route with its first page, /drafts: a pathless
 * route with no pages clashes with "/" in the route tree.
 */
export function requireAccount({
  context,
  location,
}: {
  context: { viewer: Viewer }
  location: ParsedLocation
}) {
  if (!context.viewer || context.viewer.isAnonymous)
    throw redirect({ to: "/sign-in", search: { redirect: location.href } })
}
