import type { Orpc } from "@/lib/orpc"

/**
 * The shared draft for /s/:token, read once per page load. Never stale, so
 * a focus or a remount doesn't call share.view again: that would cost a
 * Worker request, a DB read and a share_viewed log, and it can't show a
 * revoke anyway (a failed refetch keeps the old data). A reload still reads
 * it fresh: the page is SSR'd and never cached (no-store).
 */
export function sharedDraftQuery(orpc: Orpc, token: string) {
  return orpc.share.view.queryOptions({
    input: { token },
    staleTime: Number.POSITIVE_INFINITY,
  })
}
