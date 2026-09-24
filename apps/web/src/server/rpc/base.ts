import { getDraft, type Db } from "@workspace/db"
import { os } from "@orpc/server"
import type {
  RequestHeadersPluginContext,
  ResponseHeadersPluginContext,
} from "@orpc/server/plugins"

import type { Auth, Session } from "../auth"

// Every procedure is built from one of these (spec §5 API): `pub` for
// anyone, `authed` for a signed-in user or guest, and `authed` + `draftOwner`
// for anything that reads or writes a draft.

export type BaseContext = RequestHeadersPluginContext &
  ResponseHeadersPluginContext & { db: Db; auth: Auth }
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
  return next({ context: { user: response.user, session: response.session } })
})

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
