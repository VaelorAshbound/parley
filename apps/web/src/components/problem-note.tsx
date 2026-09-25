import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { InfoIcon } from "lucide-react"

/**
 * Why something the user asked for didn't happen (a limit reached, a draft
 * that didn't start), and the way past it: a link, or Try again when
 * `onRetry` is given. Not an error color: nothing broke.
 */
export function ProblemNote({
  problem,
  onRetry,
  className,
}: {
  problem: { message: string; action?: { label: string; href: string } }
  onRetry?: () => void
  className?: string
}) {
  return (
    <Alert className={cn("enter", className)}>
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
      {onRetry ? (
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
