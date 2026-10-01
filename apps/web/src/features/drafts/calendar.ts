import { Temporal } from "temporal-polyfill"

// The history's days, in the user's own time zone (spec §1 Left sidebar).
// The server renders with the zone the browser saved in a cookie, so the
// page arrives already grouped the way the browser will show it.

/** Where the user is: their time zone and their calendar day there. */
export type Calendar = { timeZone: string; today: Temporal.PlainDate }

export const timeZoneCookie = "tz"

export type DayGroup<T> = {
  label: "Today" | "Yesterday" | "Last 7 days" | "Older"
  drafts: T[]
}

/**
 * Drafts (already last-changed first) under Today, Yesterday, Last 7 days
 * and Older. Empty groups are left out.
 */
export function groupByDay<T extends { updatedAt: Date }>(
  drafts: T[],
  calendar: Calendar
): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [
    { label: "Today", drafts: [] },
    { label: "Yesterday", drafts: [] },
    { label: "Last 7 days", drafts: [] },
    { label: "Older", drafts: [] },
  ]
  for (const draft of drafts) {
    const label = dayLabel(
      calendar.today.since(dayOf(draft.updatedAt, calendar)).days
    )
    groups.find((group) => group.label === label)?.drafts.push(draft)
  }
  return groups.filter((group) => group.drafts.length > 0)
}

/** The group of a draft last changed `days` ago (0 or less: today). */
function dayLabel(days: number): DayGroup<unknown>["label"] {
  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days <= 7) return "Last 7 days"
  return "Older"
}

/** When a draft last changed, short: "9:05 AM", "Sep 2", "Dec 30, 2025". */
export function updatedLabel(updatedAt: Date, calendar: Calendar) {
  const day = dayOf(updatedAt, calendar)
  const options: Intl.DateTimeFormatOptions = day.equals(calendar.today)
    ? { hour: "numeric", minute: "2-digit" }
    : day.year === calendar.today.year
      ? { month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" }
  // One fixed locale and plain spaces: the server and every browser print
  // exactly the same text, so hydration never changes it.
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: calendar.timeZone,
  })
    .format(updatedAt)
    .replaceAll(/\s/g, " ")
}

/** A time zone from the cookie, or UTC when it is missing or not real. */
export function readTimeZone(value: string | undefined) {
  if (!value) return "UTC"
  try {
    return Temporal.Now.zonedDateTimeISO(value).timeZoneId
  } catch {
    return "UTC"
  }
}

/** Today's calendar in `timeZone`, as a string that changes once a day. */
export function todayKey(timeZone: string) {
  return calendarKey({ timeZone, today: Temporal.Now.plainDateISO(timeZone) })
}

/** The browser's own calendar key. */
export function browserCalendarKey() {
  return todayKey(Temporal.Now.timeZoneId())
}

export function calendarKey({ timeZone, today }: Calendar) {
  return `${today.toString()} ${timeZone}`
}

export function parseCalendarKey(key: string): Calendar {
  const [today = "", timeZone = "UTC"] = key.split(" ")
  return { timeZone, today: Temporal.PlainDate.from(today) }
}

function dayOf(date: Date, { timeZone }: Calendar) {
  return Temporal.Instant.fromEpochMilliseconds(date.getTime())
    .toZonedDateTimeISO(timeZone)
    .toPlainDate()
}
