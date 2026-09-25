import { useEffect, useSyncExternalStore } from "react"
import { Temporal } from "temporal-polyfill"

import { readBrowserCookie, writeCookie } from "@/lib/browser-cookies"

import {
  browserCalendarKey,
  parseCalendarKey,
  timeZoneCookie,
  type Calendar,
} from "./calendar"

/**
 * The user's calendar day and time zone. The page hydrates with the server's
 * answer (`serverKey`, from the time zone cookie), so nothing changes while
 * React takes over; then the browser's own clock wins, and it rolls over at
 * midnight. https://react.dev/reference/react/useSyncExternalStore#adding-support-for-server-rendering
 */
export function useCalendar(serverKey: string): Calendar {
  const key = useSyncExternalStore(
    everyMinute,
    browserCalendarKey,
    () => serverKey
  )
  // Saves the zone for the next page the server renders.
  useEffect(() => {
    const timeZone = Temporal.Now.timeZoneId()
    if (readBrowserCookie(timeZoneCookie) !== timeZone)
      writeCookie(timeZoneCookie, timeZone)
  }, [])
  return parseCalendarKey(key)
}

function everyMinute(onChange: () => void) {
  const timer = setInterval(onChange, 60_000)
  return () => clearInterval(timer)
}
