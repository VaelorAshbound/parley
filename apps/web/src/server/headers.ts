// The security headers of every page (T38, spec §5 Hono). /api has its own
// (secureHeaders in api.ts): it serves JSON, never a page.
//
// The CSP runs only scripts that carry this response's nonce, and what those
// scripts load ('strict-dynamic': Vite's chunks, Turnstile's api.js). TanStack
// Start puts the nonce on its own inline scripts and in a `csp-nonce` meta
// tag, where the browser's router reads it back (router.tsx).
// https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy

/** 16 random bytes, base64: a new one for every page response. */
export function newNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes))
}

/** Turnstile's script and its challenge frame (spec §5 Auth). */
const TURNSTILE = "https://challenges.cloudflare.com"

function contentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    // 'self' and https: only count in browsers without 'strict-dynamic'.
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'self' ${TURNSTILE}`,
    // React renders style props as attributes, and Motion animates them.
    // No nonce here: it would make browsers ignore 'unsafe-inline'.
    "style-src 'self' 'unsafe-inline'",
    // Fonts and images are bundled, some inlined as data: URLs.
    "font-src 'self' data:",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    `frame-src ${TURNSTILE}`,
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    // Sign-in, checkout and the portal leave by script, not by form.
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ")
}

/** The headers of a page response, with its script nonce. */
export function pageHeaders(nonce: string) {
  return {
    "Content-Security-Policy": contentSecurityPolicy(nonce),
    // A year, and not `preload`: that is hard to undo for the whole zone.
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    // For browsers without frame-ancestors.
    "X-Frame-Options": "DENY",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  }
}

/**
 * The response with the page headers added. A header the route set itself
 * wins (a share page's `no-referrer`). Copied first: a redirect's headers
 * can't be changed in place.
 */
export function withPageHeaders(response: Response, nonce: string) {
  const copy = new Response(response.body, response)
  for (const [name, value] of Object.entries(pageHeaders(nonce))) {
    if (!copy.headers.has(name)) copy.headers.set(name, value)
  }
  return copy
}
