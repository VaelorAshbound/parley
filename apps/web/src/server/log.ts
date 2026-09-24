import { getContext } from "hono/context-storage"

// Structured logs for Workers Logs: one JSON object per line, a stable event
// name, and the request id so one request can be followed (spec §5 Hono).
// Never pass values people typed, tokens or request bodies. T29 builds on it.

function requestId() {
  try {
    return getContext<{ Variables: { requestId: string } }>().var.requestId
  } catch {
    // Outside a request (tests, cron).
    return undefined
  }
}

export function logError(
  event: string,
  error: unknown,
  fields: Record<string, string | number | boolean> = {}
) {
  console.error(
    JSON.stringify({
      level: "error",
      event,
      requestId: requestId(),
      ...fields,
      // Name and message only: database errors keep row values in `detail`.
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { message: String(error) },
    })
  )
}
