# ADR-0005: Logs and AI metrics as structured events in Workers Observability

## Status

Accepted (T29, 2026-09-25)

## Context

T29 asks for structured logs (request id, route, status, latency, user tier) and AI metrics per chat turn (tokens, cost, time to first token, tool errors), visible in Workers Observability, with **no field values or chat text** (spec §9).

The questions on-call will ask:

1. Is the API failing, and on which route? For whom (guest, free)?
2. Is it slow, and where does a slow request spend its time?
3. What does the AI cost per turn, per day, per tier? Is a user burning the budget?
4. Does the chat feel fast (time to first token)? Does the model misuse its tools?

The platform facts (docs checked 2026-09-25):

- Workers Logs indexes the keys of a logged object, and the Query Builder can filter, group and chart any of them (count, sum, avg, P50–P999). [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/#logging-structured-json-objects), [Query Builder](https://developers.cloudflare.com/workers/observability/query-builder/)
- Automatic tracing records every outbound fetch and binding call, with no SDK. It must be turned on (`observability.traces.enabled`). [Traces](https://developers.cloudflare.com/workers/observability/traces/)
- From 2026-10-01, log events and trace spans share one quota: 20M a month in Workers Paid, then $0.60 per million.
- OpenRouter reports what it charged in every response (`usage.cost`), and the AI SDK measures each step's time to first output (`performance.timeToFirstOutputMs`). [OpenRouter usage accounting](https://openrouter.ai/docs/use-cases/usage-accounting)

## Decision

**Metrics are fields on log events.** No separate metrics store.

| Event                    | When                                                                           | Fields                                                                                                                                                                                                                                                                                    | Answers |
| ------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `request`                | every `/api` request (`src/server/middleware.ts`)                              | `requestId` (Cloudflare's ray id), `method`, `route` (the matched pattern or the oRPC procedure, never the path or query), `status`, `latencyMs` (to the response headers), `userId`, `tier`                                                                                              | 1, 2    |
| `chat_turn`              | once per chat turn: `outcome` done, aborted or error (`src/server/ai/chat.ts`) | `draftId`, `userId`, `tier`, `model`, `finishReason`, `steps`, `inputTokens`, `cachedInputTokens`, `outputTokens`, `costMicroUsd` (what OpenRouter charged), `ttftMs`, `durationMs`, `toolCalls`, `toolErrors`, `failedTools`, `rejectedChanges`, and on error `errorName`, `errorStatus` | 3, 4    |
| `api_error`, `rpc_error` | an unexpected error (T14)                                                      | `error`: the error's `name`, `code` (a Postgres SQLSTATE or a system code) and `cause` (its cause's name). Never its message                                                                                                                                                              | 1       |
| `chat_save_failed`       | a chat reply could not be saved after it streamed                              | `draftId`, `error` as above                                                                                                                                                                                                                                                               | 1       |
| `auth_log`               | Better Auth's own error and warning lines                                      | `message`: its fixed text only (cut at the first colon, quote or new line), `error` as above                                                                                                                                                                                              | 1       |

Rules, enforced by types and tests:

- Log fields are flat values (`string | number | boolean`), so a body, draft or message can't be passed by accident.
- Only IDs, counts, durations and names from fixed sets. Workerd tests send a real draft value, chat text and a session, and check that none of it reaches any console output.
- **No error message is ever logged.** Drizzle wraps every failed query in `DrizzleQueryError`, whose message is `Failed query: <sql>\nparams: <values>`: draft values, chat text, session tokens. Postgres and `JSON.parse` quote the value that failed. We log the name and code instead. Workerd tests break the database on purpose (a read-only session, a missing schema, a NUL in a reply) and check no value reaches the console.
- Better Auth's default logger printed the whole error. Its `logger.log` now sends its lines to ours as `auth_log`.
- Nothing is left to fail uncaught: Workers logs an uncaught error in full. The reply save in `waitUntil` has its own catch.
- A failed turn logs the error's **name** (and HTTP status), not its message: AI SDK errors can quote what the model wrote. Our `onError` replaces the AI SDK default, which logged the whole error. The line is written when the turn ends, so a step that failed part way still counts its tokens and cost.
- `redact_query_string: true` keeps query strings (Better Auth tokens, OAuth codes) out of Cloudflare's own invocation logs and traces. **Paths are not redacted:** the invocation log keeps the full path. Tokens must never go in a path segment. Better Auth's default reset link does (`/reset-password/:token`), so T21 sends its own link with the token in the query.
- Traces are on at full sampling, for "where did the time go".

## Alternatives Considered

### Workers Analytics Engine for the metrics

- Pros: Built for metrics, SQL, 90-day retention.
- Cons: A second store and binding, a SQL API instead of the dashboard, and the same numbers already sit in the logs. 7 days of logs is enough for on-call.
- Rejected for now. If the owner wants long-term cost charts, T27's daily `aiUsage` rows in Postgres already hold spend per user and day.

### AI SDK telemetry (OpenTelemetry spans)

- Pros: Standard GenAI span attributes.
- Cons: Needs an OpenTelemetry tracer in the Worker; Workers' tracing has its own span API, and span attributes would repeat the same numbers.
- Rejected: the step callbacks give every number with less code.

### Cost from the list price (as the evals do)

- Pros: Works without the provider's report.
- Cons: An estimate; OpenRouter's `usage.cost` is what we actually pay.
- Rejected for production logs. When a call has no reported cost, `costMicroUsd` is left out, not guessed.

### Hono's built-in `logger()`

- Rejected: it prints the full path and query as text, and a path can hold a token. `requestLog` is our one custom middleware (spec §5 Hono). Our line never has the path; Cloudflare's invocation log does (see the path rule above).

## Consequences

- Page (SSR) requests have no `request` line of ours. Cloudflare's invocation log covers them (URL without the query, status, wall time); their data comes through the same oRPC procedures in-process.
- `route` for Better Auth is `/api/auth/*`. Which auth endpoint is in the invocation log; T21 owns auth's own audit logs.
- The request line of a streamed chat reply has the time to the headers; the whole turn is in `chat_turn`.
- Alerts are not set up yet (no production traffic). Symptom alerts (5xx rate, P95 `ttftMs`, daily cost) belong with production (T38).

## Queries (Workers Observability → Investigate)

- **Errors by route:** filter `event = request` and `status >= 500`; Count; group by `route`.
- **Latency:** filter `event = request`; P95 of `latencyMs`; group by `route`.
- **Follow one request:** filter `requestId = <id>` (it is Cloudflare's ray id, so the invocation log lines up).
- **AI spend:** filter `event = chat_turn`; Sum of `costMicroUsd` (millionths of a dollar); group by `tier`.
- **Time to first token:** filter `event = chat_turn` and `outcome = done`; P50 and P95 of `ttftMs`.
- **Tool trouble:** filter `event = chat_turn` and `toolErrors > 0`; group by `failedTools`. `rejectedChanges` counts values the engine refused.
