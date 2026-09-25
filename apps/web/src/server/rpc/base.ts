import { createRatelimitMiddleware } from "@orpc/experimental-ratelimit"
import { getDraft, type Db } from "@workspace/db"
import { os } from "@orpc/server"
import type { LanguageModel } from "ai"
import type {
  RequestHeadersPluginContext,
  ResponseHeadersPluginContext,
} from "@orpc/server/plugins"

import type { Auth, Session } from "../auth"
import type { PrintPdf } from "../files"
import type { Limiters } from "../limits"
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
    /** Prints the PDFs: Browser Run in the Worker; tests pass a fake. */
    printPdf: PrintPdf
    /** Keeps the Worker alive for work after the response (saving a reply). */
    waitUntil: (promise: Promise<unknown>) => void
    /** Per-user rate limits (the Rate Limiting bindings, spec §2 Limits). */
    limiters: Limiters
  }
type AuthedContext = BaseContext & Session

const errors = {
  UNAUTHORIZED: { message: "Please sign in to continue." },
  // The same answer for "not yours" and "doesn't exist", so ids can't be
  // probed.
  NOT_FOUND: { message: "We couldn't find that draft." },
  // oRPC's rate-limit middleware throws this code; declared so it is typed
  // for the browser. No message: the middleware's own ("Too Many Requests")
  // wins, and the UI words it from the code.
  TOO_MANY_REQUESTS: { status: 429 },
}

export const pub = os.$context<BaseContext>().errors(errors)

/** The caller's session; `fresh` skips the 5-minute cookie cache. */
async function readSession(context: BaseContext, { fresh = false } = {}) {
  const { headers, response } = await context.auth.api.getSession({
    headers: context.reqHeaders ?? new Headers(),
    query: { disableCookieCache: fresh },
    returnHeaders: true,
  })
  // Refreshed or cleared session cookies must reach the browser, also when
  // the session turns out to be gone.
  for (const cookie of headers.getSetCookie())
    context.resHeaders?.append("set-cookie", cookie)
  return response
}

/**
 * A per-user rate limit on one of the context's limiters. oRPC's middleware
 * throws TOO_MANY_REQUESTS (429) past the limit. Cloudflare's binding only
 * answers "allowed or not", so there are no RateLimit-* headers to send
 * (oRPC's headers plugin would add none).
 * https://orpc.dev/docs/helpers/ratelimit
 */
export function perUser(limiter: keyof Limiters) {
  return createRatelimitMiddleware<AuthedContext>({
    limiter: ({ context }) => context.limiters[limiter],
    key: ({ context }) => context.user.id,
  })
}

export const authed = pub
  .use(async ({ context, next, errors }) => {
    const session = await readSession(context)
    if (!session) throw errors.UNAUTHORIZED()
    annotate({ userId: session.user.id, tier: tierOf(session.user) })
    return next({ context: { user: session.user, session: session.session } })
  })
  // /api/rpc isn't under Better Auth's limiter (T14 review). The AI's tool
  // calls run inside a chat turn's context, and count once with it (the
  // middleware's dedupe).
  .use(perUser("rpc"))

/** A user's plan, for logs and metrics (T29). T26 adds "pro". */
export function tierOf(user: { isAnonymous?: boolean | null }) {
  return user.isAnonymous ? ("guest" as const) : ("free" as const)
}
export type Tier = ReturnType<typeof tierOf>

/**
 * A signed-up user with a confirmed email: export, share and upgrade (spec
 * §2 Limits), so fake addresses can't use up the free quota. Guests are
 * asked to sign in.
 */
export const verified = authed
  .errors({
    EMAIL_NOT_VERIFIED: {
      message: "Please confirm your email first. We sent you a link.",
    },
  })
  .use(async ({ context, next, errors }) => {
    if (context.user.isAnonymous) throw errors.UNAUTHORIZED()
    if (context.user.emailVerified) return next()
    // The cookie cache can be up to 5 minutes old, for example when the link
    // was opened on a phone: ask the database before saying no.
    const session = await readSession(context, { fresh: true })
    if (!session) throw errors.UNAUTHORIZED()
    if (!session.user.emailVerified) throw errors.EMAIL_NOT_VERIFIED()
    return next({ context: { user: session.user, session: session.session } })
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
