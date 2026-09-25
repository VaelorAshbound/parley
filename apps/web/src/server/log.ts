import { getContext } from "hono/context-storage"

// Structured logs for Workers Logs (spec §5 Hono, T29): one object per line,
// a stable event name, and the request id so one request can be followed.
// Workers Logs indexes the keys of a logged object, so every field can be
// filtered, grouped and charted in Workers Observability:
// https://developers.cloudflare.com/workers/observability/logs/workers-logs/#logging-structured-json-objects
//
// Fields are flat values only, so an object (a request body, a draft, a
// message) can't be logged by accident. Never pass what people typed: IDs,
// counts, names from a fixed set, and durations only.

/** A log field: undefined ones are left out. */
export type LogField = string | number | boolean | undefined
export type LogFields = Record<string, LogField>

function request() {
  try {
    return getContext<{ Variables: { requestId: string } }>()
  } catch {
    // Outside a Hono request: tests, SSR, cron.
    return undefined
  }
}

/** The request id of the /api request being handled, if any. */
export function currentRequestId(): string | undefined {
  return request()?.var.requestId
}

function line(level: string, event: string, fields: LogFields) {
  const out: Record<string, unknown> = {
    level,
    event,
    requestId: currentRequestId(),
    ...fields,
  }
  for (const key of Object.keys(out))
    if (out[key] === undefined) delete out[key]
  return out
}

/** Something happened that on-call may ask about (a request, a chat turn). */
export function logInfo(event: string, fields: LogFields = {}) {
  console.log(line("info", event, fields))
}

/** Something refused but handled. */
export function logWarn(event: string, fields: LogFields = {}) {
  console.warn(line("warn", event, fields))
}

/** Something broke that someone may need to fix. */
export function logError(
  event: string,
  error: unknown,
  fields: LogFields = {}
) {
  console.error({
    ...line("error", event, fields),
    // Name and message only: database errors keep row values in `detail`.
    error:
      error instanceof Error
        ? { name: error.name, message: error.message }
        : { message: String(error) },
  })
}
