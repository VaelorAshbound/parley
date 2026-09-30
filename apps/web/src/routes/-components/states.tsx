import { useQuery } from "@tanstack/react-query"
import {
  isNotFound,
  Link,
  useLocation,
  useRouter,
  type AnyRouteMatch,
  type ErrorComponentProps,
} from "@tanstack/react-router"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"

import { Logo } from "@/components/logo"
import { viewerQuery } from "@/lib/session"

// Friendly pages for "not found" and "something broke". A draft that isn't
// yours is "not found" too, so drafts can't be probed.

export const notFoundTitle = "Page not found · Parley"

/**
 * Whether a route match shows a not-found page, for its head's title: a
 * route that caught notFound(), or the root when no route matched.
 *
 * `_notFound` is router-core's internal flag, and the only sign of the
 * root's global not-found (no route matched: status stays "success" and
 * error is unset). A router update may rename it: e2e/not-found.spec.ts
 * checks the /nope-404 title, so that breaks loudly.
 */
export function showsNotFound(
  match: Pick<AnyRouteMatch, "status" | "error" | "_notFound">
) {
  return (
    match.status === "notFound" ||
    match._notFound === true ||
    isNotFound(match.error)
  )
}

/**
 * The not-found message, for inside a <main>. The visitor most likely to
 * hold a draft link is its owner, signed out: anyone without an account
 * gets a way to sign in and come back, and nothing says whether the draft
 * exists (PAR-36).
 */
export function NotFoundMessage() {
  // Outside the app shell the viewer is only known once the browser asks:
  // until then the page offers Sign in.
  const { data: viewer } = useQuery(viewerQuery)
  const href = useLocation({ select: (location) => location.href })
  const isAccount = viewer != null && !viewer.isAnonymous
  return (
    <Empty className="flex-1 gap-8">
      <EmptyHeader className="max-w-md gap-3">
        <h1 className="font-serif text-4xl leading-[1.04] font-normal tracking-[-0.024em] text-balance md:text-[2.875rem]">
          We couldn’t find that page
        </h1>
        <EmptyDescription className="text-base text-pretty">
          It may have moved, or it belongs to someone else.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row flex-wrap justify-center gap-2">
        <Link to="/" className={buttonVariants()}>
          Start a new draft
        </Link>
        {!isAccount && (
          <Link
            to="/sign-in"
            search={{ redirect: href }}
            className={buttonVariants({ variant: "outline" })}
          >
            Sign in
          </Link>
        )}
      </EmptyContent>
    </Empty>
  )
}

/** The not-found page outside the app shell: the logo and its own <main>. */
export function NotFound() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 shrink-0 items-center px-4 md:h-17 md:px-12">
        <Link
          to="/"
          aria-label="Parley home"
          className="flex h-8 items-center text-xl"
        >
          <Logo />
        </Link>
      </header>
      <main
        id="content"
        tabIndex={-1}
        className="flex flex-1 flex-col pb-14 outline-none"
      >
        <NotFoundMessage />
      </main>
    </div>
  )
}

export function RouteError({ reset }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <Empty className="min-h-svh">
      <EmptyHeader>
        <EmptyTitle>Something went wrong</EmptyTitle>
        <EmptyDescription>
          Your drafts are safe. Please try again.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          onClick={() => {
            reset()
            void router.invalidate()
          }}
        >
          Try again
        </Button>
      </EmptyContent>
    </Empty>
  )
}
