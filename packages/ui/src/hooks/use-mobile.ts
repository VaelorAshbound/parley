import { useSyncExternalStore } from "react"

// shadcn's hook, read with useSyncExternalStore instead of setState in an
// effect, so the React Compiler can optimize callers.
// https://react.dev/reference/react/useSyncExternalStore#subscribing-to-a-browser-api
const query = "(max-width: 767px)"

function subscribe(onChange: () => void) {
  const media = window.matchMedia(query)
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}

export function useIsMobile() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    // The server can't know; layouts that differ on phones use CSS
    // breakpoints, so this only drives behavior after hydration.
    () => false
  )
}
