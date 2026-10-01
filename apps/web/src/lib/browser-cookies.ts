// Cookies from the browser side only, with no server code in the import:
// components (and their browser tests) use these; loaders use
// `readCookie` from ./cookies, which also works during SSR.

export function readBrowserCookie(name: string) {
  const prefix = `${name}=`
  const found = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(prefix))
  return found === undefined
    ? undefined
    : decodeURIComponent(found.slice(prefix.length))
}

export function writeCookie(name: string, value: string) {
  // A year, readable by the server; layout only, nothing private.
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`
}
