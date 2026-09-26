import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import type { ReactNode } from "react"

/** What a settings form last did, in words for people. */
export type Status =
  | { kind: "idle" }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string }

export const idle: Status = { kind: "idle" }

/**
 * A settings form's button and its result. Success shows beside the button
 * in a polite live region (always in the page, so screen readers hear it,
 * and nothing moves); an error is an alert above.
 */
export function SubmitRow({
  status,
  submitting,
  children,
}: {
  status: Status
  submitting: boolean
  /** The button's words. */
  children: ReactNode
}) {
  return (
    <>
      {status.kind === "error" && (
        <Alert variant="destructive">
          <AlertDescription>{status.message}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting && <Spinner data-icon="inline-start" />}
          {children}
        </Button>
        <output className="text-sm text-muted-foreground">
          {status.kind === "done" ? status.message : null}
        </output>
      </div>
    </>
  )
}
