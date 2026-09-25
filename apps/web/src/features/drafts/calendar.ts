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
    const days = calendar.today.since(dayOf(draft.updatedAt, calendar)).days
    const group = days <= 0 ? 0 : days === 1 ? 1 : days <= 7 ? 2 : 3
    groups[group]?.drafts.push(draft)
  }
  return groups.filter((group) => group.drafts.length > 0)
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

/** The browser's own calendar, as a string that changes once a day. */
export function browserCalendarKey() {
  const timeZone = Temporal.Now.timeZoneId()
  return `${Temporal.Now.plainDateISO(timeZone).toString()} ${timeZone}`
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
