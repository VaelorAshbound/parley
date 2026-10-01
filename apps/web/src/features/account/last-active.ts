import { Temporal } from "temporal-polyfill"

// "Active 3 hours ago" for the signed-in devices list. Only the time since
// matters, not the time zone, so the server and the browser write the same
// words and hydration matches (it could differ only on the edge of a unit).

const words = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

/** Each unit, and its size in minutes, largest first. */
const units = [
  ["month", 30 * 24 * 60],
  ["day", 24 * 60],
  ["hour", 60],
  ["minute", 1],
] as const

export function lastActive(date: Date, now: Date) {
  const minutes = Temporal.Instant.fromEpochMilliseconds(now.getTime())
    .since(Temporal.Instant.fromEpochMilliseconds(date.getTime()))
    .total("minutes")
  if (minutes < 5) return "Active now"
  const [unit, size] = units.find(([, each]) => minutes >= each) ?? units[3]
  return `Active ${words.format(-Math.floor(minutes / size), unit)}`
}
