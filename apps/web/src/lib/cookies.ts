import { createIsomorphicFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"

/**
 * A cookie from the page request (SSR) or the browser, for layout choices
 * that must render the same on the server as on the client (no layout
 * shift): the sidebar and the document panel size.
 */
export const readCookie = createIsomorphicFn()
  .server((name: string) => getCookie(name))
  .client((name: string) => {
    const prefix = `${name}=`
    const found = document.cookie
      .split("; ")
      .find((cookie) => cookie.startsWith(prefix))
    return found === undefined
      ? undefined
      : decodeURIComponent(found.slice(prefix.length))
  })

export function writeCookie(name: string, value: string) {
  // A year, readable by the server; layout only, nothing private.
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`
}
