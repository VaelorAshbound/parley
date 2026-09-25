import { getDraft, type Db } from "@workspace/db"
import { os } from "@orpc/server"
import type { LanguageModel } from "ai"
import type {
  RequestHeadersPluginContext,
  ResponseHeadersPluginContext,
} from "@orpc/server/plugins"

import type { Auth, Session } from "../auth"
import { annotate } from "../log"

// Every procedure is built from one of these (spec §5 API): `pub` for
// anyone, `authed` for a signed-in user or guest, and `authed` + `draftOwner`
// for anything that reads or writes a draft.

export type BaseContext = RequestHeadersPluginContext &
  ResponseHeadersPluginContext & {
    db: Db
    auth: Auth
    /** The chat's model; tests pass a scripted one. */
    model: LanguageModel
    /** Keeps the Worker alive for work after the response (saving a reply). */
    waitUntil: (promise: Promise<unknown>) => void
  }
type AuthedContext = BaseContext & Session

const errors = {
  UNAUTHORIZED: { message: "Please sign in to continue." },
  // The same answer for "not yours" and "doesn't exist", so ids can't be
  // probed.
  NOT_FOUND: { message: "We couldn't find that draft." },
}

export const pub = os.$context<BaseContext>().errors(errors)

export const authed = pub.use(async ({ context, next, errors }) => {
  const { headers, response } = await context.auth.api.getSession({
    headers: context.reqHeaders ?? new Headers(),
    returnHeaders: true,
  })
  // Refreshed or cleared session cookies must reach the browser, also when
  // the session turns out to be gone.
  for (const cookie of headers.getSetCookie())
    context.resHeaders?.append("set-cookie", cookie)
  if (!response) throw errors.UNAUTHORIZED()
  annotate({ userId: response.user.id, tier: tierOf(response.user) })
  return next({ context: { user: response.user, session: response.session } })
})

/** A user's plan, for logs and metrics (T29). T26 adds "pro". */
export function tierOf(user: { isAnonymous?: boolean | null }) {
  return user.isAnonymous ? ("guest" as const) : ("free" as const)
}

/**
 * Loads the draft named by the input and checks the user owns it. Use with
 * the draft id mapped from the input: `.use(draftOwner, (input) => input.id)`.
 */
export const draftOwner = os
  .$context<AuthedContext>()
  .errors(errors)
  .middleware(async ({ context, next, errors }, id: string) => {
    const draft = await getDraft(context.db, { id, userId: context.user.id })
    if (!draft) throw errors.NOT_FOUND()
    return next({ context: { draft } })
  })
