// k6 burst test (spec §6 "Load (light)", T35): 50 guests chat at the same
// time on a Worker Preview with the scripted AI (free, no LLM cost).
//
//   k6 run -e PREVIEW_URL=https://<branch>-parley.<account>.workers.dev load/chat.k6.js
//   docker run --rm -i -v "$PWD/load:/load" grafana/k6 run \
//     -e PREVIEW_URL=… /load/chat.k6.js      (writes /load/chat.k6-report.json)
//
// It checks that under a burst:
// - there are no 5xx errors, anywhere;
// - 50 concurrent chats all get their reply (the first turn of each guest);
// - the per-user AI limit holds (10 messages per 10 s: a guest firing 12 at
//   once gets some 429 TOO_MANY_REQUESTS);
// - the daily guest limit holds (20 messages: no guest gets more replies,
//   the rest get 429 DAILY_LIMIT).
// Never run it against production: setup() refuses any host that isn't a
// workers.dev Preview or localhost, and any target without the scripted AI.
import { check, sleep } from "k6"
import exec from "k6/execution"
import http from "k6/http"
import { Counter, Rate, Trend } from "k6/metrics"

const GUESTS = Number(__ENV.GUESTS ?? 50)
/** Messages a guest fires at once: past the 10-per-10-s AI limit. */
const BURST = 12
/** A guest's daily messages (src/lib/limits.ts DAILY_MESSAGES.guest). */
const DAILY_GUEST_MESSAGES = 20
const TURNSTILE_TEST_TOKEN = "XXXX.DUMMY.TOKEN.XXXX"

const serverErrors = new Counter("server_errors")
const firstTurnOk = new Rate("first_turn_ok")
const aiLimited = new Counter("ai_limited")
const dailyLimited = new Counter("daily_limited")
const overDailyLimit = new Counter("guests_over_daily_limit")
const turnTime = new Trend("chat_turn_ms", true)

export const options = {
  // 50 guest sign-ins, rate limited per IP (5 per 10 s on a Preview).
  setupTimeout: "6m",
  scenarios: {
    burst: {
      executor: "per-vu-iterations",
      vus: GUESTS,
      iterations: 1,
      maxDuration: "5m",
    },
  },
  thresholds: {
    server_errors: ["count==0"],
    first_turn_ok: ["rate==1"],
    ai_limited: ["count>0"],
    daily_limited: ["count>0"],
    guests_over_daily_limit: ["count==0"],
    checks: ["rate==1"],
  },
}

// 429 is an answer here, not a failure: it is the limits working.
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 299 }, 429))

function target() {
  const url = __ENV.PREVIEW_URL
  if (!url) throw new Error("Set PREVIEW_URL to the Worker Preview to test.")
  const origin = url.replace(/\/+$/, "")
  const host = origin.replace(/^https?:\/\//, "").split(":")[0]
  if (host === "parley.runtimedrift.dev")
    throw new Error("Never load-test production.")
  if (!host.endsWith(".workers.dev") && host !== "localhost")
    throw new Error(`${host} is not a Worker Preview or a local server.`)
  return origin
}

function counted(response) {
  if (response.status >= 500) serverErrors.add(1)
  return response
}

/** Signs in a new guest (waits on 429) and gives it a draft. */
function newGuest(base) {
  for (let attempt = 1; attempt <= 30; attempt++) {
    const signIn = counted(
      http.post(`${base}/api/auth/sign-in/anonymous`, "{}", {
        headers: {
          "content-type": "application/json",
          origin: base,
          "x-captcha-response": TURNSTILE_TEST_TOKEN,
        },
        // A fresh jar: with the last guest's session cookie, Better Auth
        // refuses a new anonymous sign-in (400).
        jar: new http.CookieJar(),
        tags: { name: "sign-in" },
      })
    )
    if (signIn.status === 429) {
      sleep(Number(signIn.headers["X-Retry-After"] ?? 1))
      continue
    }
    if (signIn.status !== 200)
      throw new Error(`Guest sign-in failed: ${signIn.status}`)
    const cookie = Object.values(signIn.cookies)
      .map((each) => `${each[0].name}=${each[0].value}`)
      .concat("parley-scripted-ai=1")
      .join("; ")
    const draft = counted(
      http.post(
        `${base}/api/rpc/drafts/create`,
        JSON.stringify({ json: { today: today() } }),
        {
          headers: rpcHeaders(cookie),
          jar: new http.CookieJar(),
          tags: { name: "drafts.create" },
        }
      )
    )
    if (draft.status !== 200)
      throw new Error(`drafts.create failed: ${draft.status}`)
    return { cookie, draftId: draft.json("json.id") }
  }
  throw new Error("Guest sign-in: still rate limited after 30 tries")
}

function rpcHeaders(cookie) {
  return {
    "content-type": "application/json",
    "x-csrf-token": "orpc",
    cookie,
  }
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function chatRequest(base, guest) {
  return {
    method: "POST",
    url: `${base}/api/rpc/chat/send`,
    body: JSON.stringify({
      json: {
        id: guest.draftId,
        today: today(),
        message: {
          id: `k6-${exec.vu.idInTest}-${Math.random().toString(36).slice(2)}`,
          role: "user",
          parts: [
            {
              type: "text",
              text: "I'm sharing our product roadmap with a vendor.",
            },
          ],
        },
      },
    }),
    params: {
      headers: rpcHeaders(guest.cookie),
      // The guest's cookie is in the header; an empty jar keeps k6 from
      // adding the ones its own jar picked up.
      jar: new http.CookieJar(),
      tags: { name: "chat.send" },
      timeout: "60s",
    },
  }
}

/** What a chat.send answer was: a reply, or which limit refused it. */
function outcome(response) {
  counted(response)
  if (response.status === 200) {
    turnTime.add(response.timings.duration)
    return "reply"
  }
  if (response.status === 429) {
    const code = String(response.body).includes("DAILY_LIMIT") ? "daily" : "ai"
    ;(code === "daily" ? dailyLimited : aiLimited).add(1)
    return code
  }
  return `status ${response.status}`
}

export function setup() {
  const base = target()
  const version = http.get(`${base}/api/version`)
  if (!version.json("scriptedAi"))
    throw new Error(`${base} doesn't run the scripted AI: not a Preview.`)
  const guests = []
  for (let i = 0; i < GUESTS; i++) guests.push(newGuest(base))
  return { base, guests }
}

export default function ({ base, guests }) {
  const guest = guests[exec.vu.idInTest - 1]
  let replies = 0

  // 1. All guests at once: one chat each, 50 concurrent chats.
  const one = chatRequest(base, guest)
  const first = outcome(http.request(one.method, one.url, one.body, one.params))
  firstTurnOk.add(first === "reply")
  if (first === "reply") replies++

  // 2. Each guest fires a burst past the per-user AI limit.
  for (const response of http.batch(
    Array.from({ length: BURST }, () => chatRequest(base, guest))
  ))
    if (outcome(response) === "reply") replies++

  // 3. After the 10 s window, again: past the daily limit of 20.
  sleep(11)
  for (const response of http.batch(
    Array.from({ length: BURST }, () => chatRequest(base, guest))
  ))
    if (outcome(response) === "reply") replies++

  if (replies > DAILY_GUEST_MESSAGES) overDailyLimit.add(1)
  check(replies, {
    "a guest never gets more than its daily messages": (n) =>
      n <= DAILY_GUEST_MESSAGES,
  })
}

export function handleSummary(data) {
  const pick = (name, field) => data.metrics[name]?.values?.[field] ?? null
  const report = {
    target: __ENV.PREVIEW_URL,
    guests: GUESTS,
    requests: pick("http_reqs", "count"),
    serverErrors: pick("server_errors", "count") ?? 0,
    firstTurnOk: pick("first_turn_ok", "rate"),
    aiLimited: pick("ai_limited", "count") ?? 0,
    dailyLimited: pick("daily_limited", "count") ?? 0,
    guestsOverDailyLimit: pick("guests_over_daily_limit", "count") ?? 0,
    chatTurnMs: {
      p50: pick("chat_turn_ms", "med"),
      p95: pick("chat_turn_ms", "p(95)"),
      max: pick("chat_turn_ms", "max"),
    },
    thresholdsPassed: Object.values(data.metrics).every(
      (metric) =>
        !metric.thresholds ||
        Object.values(metric.thresholds).every((each) => each.ok)
    ),
  }
  return {
    stdout: `${JSON.stringify(report, null, 2)}\n`,
    [__ENV.REPORT ?? "load/chat.k6-report.json"]: JSON.stringify(
      { report, metrics: data.metrics },
      null,
      2
    ),
  }
}
