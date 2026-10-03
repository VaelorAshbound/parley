// /s/:token puts a bearer token (a share link) in the path (PAR-16).

function decoded(segment: string) {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/**
 * The URL with a share token replaced by ":token" and without its query, or
 * undefined when the path holds no share token.
 *
 * Read the way TanStack Router reads a path: segments decoded and matched
 * case-insensitively, so /S/<token> and /%73/<token> render the share page
 * too and must be redacted as well (PAR-31). Redacting a path that turns
 * out not to be a share page costs nothing; missing one leaks the token.
 */
export function redactShareToken(url: URL): URL | undefined {
  const [, first = "", token = "", ...rest] = url.pathname.split("/")
  const route = decoded(first).toLowerCase()
  // "/s%2F<token>": the token hides in the first segment; keep none of it.
  if (route.startsWith("s/") && route.length > 2) {
    return new URL("/s/:token", url.origin)
  }
  if (route !== "s" || token === "") return undefined
  return new URL(["", "s", ":token", ...rest].join("/"), url.origin)
}
