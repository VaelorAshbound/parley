// /s/:token puts a bearer token (a share link) in the path (PAR-16).
const SHARE = /^\/s\/[^/]+/

/**
 * The URL with a share token replaced by ":token" and without its query, or
 * undefined when the path holds no share token.
 */
export function redactShareToken(url: URL): URL | undefined {
  if (!SHARE.test(url.pathname)) return undefined
  return new URL(url.pathname.replace(SHARE, "/s/:token"), url.origin)
}
