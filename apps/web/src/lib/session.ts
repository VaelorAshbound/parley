import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"
import {
  getRequestHeaders,
  setResponseHeader,
} from "@tanstack/react-start/server"

import { requestServices } from "@/server/request-services"

/** Who is using Parley right now: what the UI needs, no tokens. */
export type Viewer = {
  id: string
  name: string
  isAnonymous: boolean
} | null

// Read on the server, in the first page response, so the page never flashes
// a signed-out state (spec §5 Auth).
const getViewer = createServerFn({ method: "GET" }).handler(
  async (): Promise<Viewer> => {
    const { auth } = await requestServices()
    const { headers, response } = await auth.api.getSession({
      headers: getRequestHeaders(),
      returnHeaders: true,
    })
    const cookies = headers.getSetCookie()
    if (cookies.length > 0) setResponseHeader("set-cookie", cookies)
    if (!response) return null
    const { id, name, isAnonymous } = response.user
    return { id, name, isAnonymous: isAnonymous === true }
  }
)

export const viewerQuery = queryOptions({
  queryKey: ["viewer"],
  queryFn: () => getViewer(),
  // Matches the session cookie cache (5 min); sign-in and sign-out
  // invalidate it at once.
  staleTime: 5 * 60 * 1000,
})
