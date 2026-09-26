import { useLayoutEffect, useRef, useState } from "react"

import { useDebouncedCallback } from "./use-debounced-callback"

/**
 * The /drafts search box. What is typed shows at once, and `search` gets it
 * after a pause. `query` is the URL's search, which can land after more has
 * been typed; the box only follows it when something else changed it (Back
 * or Forward).
 */
export function useSearchText(
  query: string | undefined,
  search: (query: string | undefined) => void
) {
  const [text, setText] = useState(query ?? "")
  // The query this box last put in the URL.
  const sent = useRef(query)
  const { run: sendLater, cancel: cancelSend } = useDebouncedCallback(
    (next: string | undefined) => {
      if (next === sent.current) return
      sent.current = next
      search(next)
    },
    250
  )

  // Layout, so the old text never paints.
  useLayoutEffect(() => {
    if (query === sent.current) return
    cancelSend()
    sent.current = query
    setText(query ?? "")
  }, [query, cancelSend])

  return {
    text,
    setText: (value: string) => {
      setText(value)
      sendLater(value.trim() || undefined)
    },
    /** Empties the box; the caller clears the URL. */
    clear: () => {
      cancelSend()
      sent.current = undefined
      setText("")
    },
  }
}
