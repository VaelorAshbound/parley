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

/** Hono variables the logger reads (and `annotate` writes). */
export type LogVariables = {
  requestId: string
  /** Facts learned while handling the request, for its request line. */
  logFields?: LogFields
}

function request() {
  try {
    return getContext<{ Variables: LogVariables }>()
  } catch {
    // Outside a Hono request: tests, SSR, cron.
    return undefined
  }
}

/** The request id of the /api request being handled, if any. */
export function currentRequestId(): string | undefined {
  return request()?.var.requestId
}

/**
 * Adds facts to the current request's request line (the user's tier, the
 * procedure). Does nothing outside a Hono request.
 */
export function annotate(fields: LogFields) {
  const c = request()
  c?.set("logFields", { ...c.var.logFields, ...fields })
}

/** The fields that have a value. */
function defined(fields: LogFields) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined)
  )
}

/** Error codes are short constants ("08006", "ECONNREFUSED"), never text. */
const CODE = /^[A-Z0-9_]{1,40}$/

function nameOf(error: unknown) {
  if (!(error instanceof Error)) return typeof error
  // Some libraries (Drizzle) keep the generic name; their class says more.
  return error.name === "Error" ? error.constructor.name : error.name
}

function codeOf(error: unknown) {
  const code: unknown =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : undefined
  return typeof code === "string" && CODE.test(code) ? code : undefined
}

/**
 * What we log of an error: its name, its code (a Postgres SQLSTATE, a system
 * code) and its cause's name. Never its message: Drizzle's holds the failed
 * query's bound values (draft values, chat text, session tokens), Postgres
 * quotes the value that failed, and JSON.parse quotes its input.
 */
function errorFields(error: unknown) {
  const cause = error instanceof Error ? error.cause : undefined
  return defined({
    name: nameOf(error),
    code: codeOf(error) ?? codeOf(cause),
    cause: cause === undefined ? undefined : nameOf(cause),
  })
}

const method = { info: "log", warn: "warn", error: "error" } as const

/**
 * An event at a level chosen at run time (a chat turn that failed), with
 * the error behind it if there is one.
 */
export function log(
  level: keyof typeof method,
  event: string,
  fields: LogFields = {},
  error?: unknown
) {
  console[method[level]]({
    ...defined({ level, event, requestId: currentRequestId(), ...fields }),
    ...(error === undefined ? {} : { error: errorFields(error) }),
  })
}

/** Something happened that on-call may ask about (a request, a chat turn). */
export function logInfo(event: string, fields: LogFields = {}) {
  log("info", event, fields)
}

/** Something refused but handled. */
export function logWarn(event: string, fields: LogFields = {}) {
  log("warn", event, fields)
}

/** Something broke that someone may need to fix. */
export function logError(
  event: string,
  error: unknown,
  fields: LogFields = {}
) {
  log("error", event, fields, error)
}
