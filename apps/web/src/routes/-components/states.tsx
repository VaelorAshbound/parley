import {
  Link,
  useRouter,
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

// Friendly pages for "not found" and "something broke". A draft that isn't
// yours is "not found" too, so drafts can't be probed.

export function NotFound() {
  return (
    <Empty className="min-h-svh">
      <EmptyHeader>
        <EmptyTitle>We couldn’t find that page</EmptyTitle>
        <EmptyDescription>
          It may have moved, or it belongs to someone else.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link to="/" className={buttonVariants()}>
          Start a new draft
        </Link>
      </EmptyContent>
    </Empty>
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
