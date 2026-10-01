/**
 * After signing in, up or out: load the next page afresh. The server then
 * renders it for the new session, and nothing cached for the person before
 * (a guest's list, or someone else's on a shared computer) stays in memory.
 * Keeping the app loaded and pruning TanStack Query's cache instead raced
 * with fetches still in flight (CancelledError, T21).
 */
export function reloadTo(path: string) {
  window.location.assign(path)
}
