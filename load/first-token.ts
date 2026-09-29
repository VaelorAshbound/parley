// `node load/first-token.ts`: the time to the first AI token on a Preview
// (spec §8: p50 under 1.5 s, p95 under 3 s), measured the way a person sees
// it: from sending a message to the model's first text or tool call, over
// the network, through the Worker, the database writes before the model and
// the stream back.
//
//   PREVIEW_URL=https://… node load/first-token.ts
//     Scripted AI (free): the Worker and database part of the time.
//   PREVIEW_URL=https://… REAL_LLM=1 SAMPLES=3 node load/first-token.ts
//     The real model, a few calls only: it costs (see the log line).
//
// Prints one JSON line and exits 1 when p50 or p95 misses the budget.
import { newDraft, newGuest, sendTurn, version } from "./guest.ts"
import { loadTestTarget, percentile } from "./measure.ts"

export const FIRST_TOKEN_BUDGET = { p50: 1500, p95: 3000 }

const base = loadTestTarget(process.env.PREVIEW_URL)
const real = process.env.REAL_LLM === "1"
const samples = Number(process.env.SAMPLES ?? (real ? 3 : 20))
if (real && samples > 5)
  throw new Error("REAL_LLM: 5 samples at most; each one costs.")

const served = await version(base)
if (!served.scriptedAi)
  throw new Error(`${base} doesn't run the scripted AI: not a Preview.`)

// A guest may send 10 AI messages per 10 s and 20 a day, and keep one
// draft, so each guest sends at most 10, one after the other, in its draft.
// The scripted AI picks the agreement and fills a field on every turn
// (database writes), as a first message does.
const perGuest = 10
const message = "I'm sharing our product roadmap with a vendor."
const times: number[] = []
let warmUp: number | null = null
while (times.length < samples) {
  const guest = await newGuest(base, { scriptedAi: !real })
  const draft = await newDraft(guest)
  for (let sent = 0; sent < perGuest && times.length < samples; sent++) {
    const turn = await sendTurn(guest, draft, message)
    if (turn.status !== 200 || turn.firstTokenMs === null)
      throw new Error(`chat.send answered ${turn.status} with no token`)
    // The first call may wake the isolate and Neon (scale to zero): shown
    // apart, and not counted, so a cold start doesn't hide in the p50.
    if (warmUp === null && !real) warmUp = turn.firstTokenMs
    else times.push(turn.firstTokenMs)
  }
}

const result = {
  target: base,
  commit: served.commit,
  model: real ? "real" : "scripted",
  samples: times.length,
  warmUpMs: warmUp === null ? null : Math.round(warmUp),
  p50Ms: Math.round(percentile(times, 50)),
  p95Ms: Math.round(percentile(times, 95)),
  budgetMs: FIRST_TOKEN_BUDGET,
}
console.log(JSON.stringify(result))
if (
  result.p50Ms > FIRST_TOKEN_BUDGET.p50 ||
  result.p95Ms > FIRST_TOKEN_BUDGET.p95
) {
  console.error("Time to first token misses the budget.")
  process.exitCode = 1
}
