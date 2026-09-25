import { useCallback, useEffect, useLayoutEffect, useRef } from "react"

/**
 * `run` calls `callback` once calls have stopped for `ms`, with the last
 * call's arguments; `cancel` drops a call still waiting. Both stay the same
 * across renders, and `run` always calls the latest `callback`.
 *
 * Hand-written, not TanStack Pacer: Pacer is still 0.x and would add three
 * packages for these few lines.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  ms: number
) {
  const latest = useRef(callback)
  useLayoutEffect(() => {
    latest.current = callback
  })
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const cancel = useCallback(() => clearTimeout(timer.current), [])
  useEffect(() => cancel, [cancel])
  const run = useCallback(
    (...args: Args) => {
      clearTimeout(timer.current)
      timer.current = setTimeout(() => latest.current(...args), ms)
    },
    [ms]
  )
  return { run, cancel }
}
