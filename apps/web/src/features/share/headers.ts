// The response headers of a share page (T25). The page holds a draft that
// can be turned off at any moment, so:
// - no cache may keep it: not the browser's back/forward store, not a CDN;
// - search engines don't list it, even when someone posts the link;
// - the address (with its token) is never sent on as a Referer;
// - no other site may show it in a frame.
export const sharePageHeaders = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "frame-ancestors 'none'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
}
