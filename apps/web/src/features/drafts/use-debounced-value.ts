import { useEffect, useState } from "react"

/**
 * `value`, once it has stopped changing for `ms`: search as you type sends
 * one request per pause, not one per key.
 */
export function useDebouncedValue<T>(value: T, ms: number) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return settled
}
