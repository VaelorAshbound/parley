import { queryOptions } from "@tanstack/react-query"
import { polarCustomerOf } from "@workspace/db"
import { createServerFn } from "@tanstack/react-start"
import {
  getRequestHeaders,
  setResponseHeader,
} from "@tanstack/react-start/server"
import { z } from "zod"

import { planOf, type Plan } from "@/lib/limits"
import { requestServices } from "@/server/request-services"

/** Who is using Parley right now: what the UI needs, no tokens. */
export type Viewer = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  isAnonymous: boolean
  /** Set by Polar's webhooks (T26). */
  plan: Plan
  /**
   * Polar knows this account as a customer (Pro now, or once): its billing
   * portal has the invoices, even after Pro ends (PAR-21).
   */
  hasBilling: boolean
} | null

// Read on the server, in the first page response, so the page never flashes
// a signed-out state (spec §5 Auth). `fresh` skips the 5-minute session
// cookie cache and refreshes it.
const getViewer = createServerFn({ method: "GET" })
  .validator(z.object({ fresh: z.boolean() }))
  .handler(async ({ data }): Promise<Viewer> => {
    const { auth, db } = await requestServices()
    const { headers, response } = await auth.api.getSession({
      headers: getRequestHeaders(),
      query: { disableCookieCache: data.fresh },
      returnHeaders: true,
    })
    const cookies = headers.getSetCookie()
    if (cookies.length > 0) setResponseHeader("set-cookie", cookies)
    if (!response) return null
    const { id, name, email, emailVerified, isAnonymous } = response.user
    const plan = planOf(response.user)
    return {
      id,
      name,
      email,
      emailVerified,
      isAnonymous: isAnonymous === true,
      plan,
      // The customer id stays off the session (never sent to the browser):
      // one read by primary key, for signed-up Free accounts only.
      hasBilling:
        plan === "pro" ||
        (isAnonymous !== true && (await polarCustomerOf(db, id)) !== undefined),
    }
  })

export const viewerQuery = queryOptions({
  queryKey: ["viewer"],
  queryFn: () => getViewer({ data: { fresh: false } }),
  // Matches the session cookie cache (5 min); sign-in and sign-out
  // invalidate it at once.
  staleTime: 5 * 60 * 1000,
})

/** The viewer from the database, for when the cookie cache may be behind. */
export function freshViewer() {
  return getViewer({ data: { fresh: true } })
}
