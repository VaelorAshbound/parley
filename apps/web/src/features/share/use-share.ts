import { ORPCError } from "@orpc/client"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "@workspace/ui/components/toast"

import type { Orpc } from "@/lib/orpc"

// Share links from the document panel (T25): copy the draft's read-only
// link, or turn it off. The server makes the link (share.create gives the
// one that is on, or a new one); the page copies its address.

/** The public address of a link. */
export function shareUrl(token: string) {
  return `${window.location.origin}/s/${token}`
}

/**
 * Copies text the server is still making. The clipboard item is written
 * during the click, while the browser still counts it as the user's own
 * action (Safari refuses a copy after an await), and waits for the text:
 * https://developer.mozilla.org/en-US/docs/Web/API/ClipboardItem/ClipboardItem
 * Rejects, like a refused copy, where there is no clipboard (plain http,
 * older browsers).
 */
async function copyLater(text: Promise<string>) {
  if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
    text.catch(() => {}) // The caller tells why the link failed.
    throw new Error("No clipboard here")
  }
  await navigator.clipboard.write([
    new ClipboardItem({
      "text/plain": text.then(
        (value) => new Blob([value], { type: "text/plain" })
      ),
    }),
  ])
}

type Problem = {
  title: string
  description: string
  action?: { label: string; href: string }
}

const TRY_AGAIN: Problem = {
  title: "We couldn’t make the link",
  description: "Please try again.",
}

/** Why no link was made, and the way past it (typed errors, spec §5 API). */
function shareProblem(error: unknown, draftPath: string): Problem {
  if (!(error instanceof ORPCError) || !error.defined) return TRY_AGAIN
  const back = encodeURIComponent(draftPath)
  switch (error.code) {
    case "UNAUTHORIZED":
      return {
        title: "Create a free account to share",
        description: "Your draft comes with you.",
        action: {
          label: "Create an account",
          href: `/sign-up?redirect=${back}`,
        },
      }
    case "EMAIL_NOT_VERIFIED":
      return {
        title: "Confirm your email to share",
        description: "We sent you a link.",
        action: {
          label: "Get a new link",
          href: `/verify-email?redirect=${back}`,
        },
      }
    case "NO_DOCUMENT":
      return { title: "Pick an agreement first", description: "Then share it." }
    default:
      return TRY_AGAIN
  }
}

function tell({ title, description, action }: Problem) {
  toast.add({
    type: "error",
    title,
    description,
    ...(action && {
      actionProps: {
        children: action.label,
        onClick: () => window.location.assign(action.href),
      },
    }),
  })
}

export function useShare(orpc: Orpc, draftId: string) {
  const queryClient = useQueryClient()
  const link = orpc.share.get.queryOptions({ input: { id: draftId } })
  const setLink = (value: Awaited<ReturnType<typeof orpc.share.get.call>>) =>
    queryClient.setQueryData(link.queryKey, value)

  async function copyLink() {
    const created = orpc.share.create.call({ id: draftId })
    const copied = copyLater(created.then(({ token }) => shareUrl(token)))
    try {
      setLink(await created)
    } catch (error) {
      // The copy fails with it; the problem is what to tell.
      copied.catch(() => {})
      tell(shareProblem(error, `/d/${draftId}`))
      return
    }
    try {
      await copied
      toast.add({
        type: "success",
        title: "Link copied",
        description: "Anyone with it can read this draft, not your chat.",
      })
    } catch {
      tell({
        title: "Your link is ready, but not copied",
        description: "The browser didn’t allow it. Open Share to copy it.",
      })
    }
  }

  async function stopSharing() {
    try {
      await orpc.share.revoke.call({ id: draftId })
      setLink(null)
      toast.add({
        title: "Link turned off",
        description: "It no longer opens this draft.",
      })
    } catch {
      tell({
        title: "We couldn’t turn the link off",
        description: "Please try again.",
      })
    }
  }

  /** Loads the link's state before the menu opens (hover or focus). */
  const prefetch = () => void queryClient.prefetchQuery(link)

  return { link, copyLink, stopSharing, prefetch }
}

export type Share = ReturnType<typeof useShare>
