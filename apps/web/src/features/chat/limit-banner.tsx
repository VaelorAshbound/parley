import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { InfoIcon } from "lucide-react"

import type { LimitProblem } from "./limit-problem"

/**
 * A limit the chat reached (spec §2 Limits), in the conversation where the
 * reply would have been: what happened, and the way past it. Not an error
 * color: nothing broke.
 */
export function LimitBanner({
  problem,
  onRetry,
}: {
  problem: LimitProblem
  onRetry: () => void
}) {
  return (
    <Alert className="enter">
      <InfoIcon />
      <AlertDescription className="text-foreground">
        {problem.message}
      </AlertDescription>
      {problem.action ? (
        <a
          href={problem.action.href}
          className={cn(
            buttonVariants({ size: "sm" }),
            "col-start-2 mt-2 w-fit"
          )}
        >
          {problem.action.label}
        </a>
      ) : null}
      {problem.retry ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="col-start-2 mt-2 w-fit"
          onClick={onRetry}
        >
          Try again
        </Button>
      ) : null}
    </Alert>
  )
}
