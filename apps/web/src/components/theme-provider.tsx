// Based on https://ui.shadcn.com/docs/dark-mode/tanstack-start, with two changes:
// - the saved theme is read with useSyncExternalStore instead of setState in an
//   effect, so the React Compiler can optimize the provider
//   (https://react.dev/reference/react/useSyncExternalStore#subscribing-to-a-browser-api);
// - the context starts undefined, so useTheme() outside the provider throws;
// - a switch turns CSS transitions off while it applies (withoutTransitions).
import { ScriptOnce } from "@tanstack/react-router"
import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

// Runs before hydration, so the right theme is on <html> at first paint.
function getThemeScript(storageKey: string, defaultTheme: Theme) {
  const key = JSON.stringify(storageKey)
  const fallback = JSON.stringify(defaultTheme)

  return `(function(){try{var t=localStorage.getItem(${key});if(t!=='light'&&t!=='dark'&&t!=='system'){t=${fallback}}var d=matchMedia('(prefers-color-scheme: dark)').matches;var r=t==='system'?(d?'dark':'light'):t;var e=document.documentElement;e.classList.add(r);e.style.colorScheme=r}catch(e){}})();`
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
  undefined
)

/**
 * Runs `apply` with CSS transitions off, so a theme switch shows the new
 * colors at once instead of fading every `transition-all` element (T4). The
 * same idea as next-themes' disableTransitionOnChange, with an attribute and
 * a rule in globals.css instead of an injected <style>, so a strict CSP
 * doesn't block it.
 */
export function withoutTransitions(apply: () => void) {
  const root = document.documentElement
  root.setAttribute("data-theme-switching", "")
  apply()
  // Reading a style makes the browser compute the new colors now, while
  // transitions are off; turning them back on then has nothing to animate.
  void getComputedStyle(root).transitionDuration
  requestAnimationFrame(() => root.removeAttribute("data-theme-switching"))
}

function applyTheme(theme: Theme) {
  withoutTransitions(() => setThemeClass(theme))
}

function setThemeClass(theme: Theme) {
  const root = document.documentElement
  root.classList.remove("light", "dark")

  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme

  root.classList.add(resolved)
  root.style.colorScheme = resolved
}

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "system"
}

// Browser-only: subscribe never runs during SSR, so no request shares this set.
const listeners = new Set<() => void>()

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  // Another tab changed the theme.
  window.addEventListener("storage", onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener("storage", onChange)
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "theme",
}: ThemeProviderProps) {
  const theme = useSyncExternalStore(
    subscribe,
    () => {
      const stored = localStorage.getItem(storageKey)
      return isTheme(stored) ? stored : defaultTheme
    },
    // The server can't read localStorage; the theme script already set <html>.
    () => defaultTheme
  )

  useEffect(() => {
    applyTheme(theme)
    if (theme !== "system") return

    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => applyTheme("system")
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [theme])

  const setTheme = (next: Theme) => {
    localStorage.setItem(storageKey, next)
    for (const listener of listeners) listener()
  }

  return (
    <ThemeProviderContext value={{ theme, setTheme }}>
      <ScriptOnce>{getThemeScript(storageKey, defaultTheme)}</ScriptOnce>
      {children}
    </ThemeProviderContext>
  )
}

export function useTheme() {
  const context = useContext(ThemeProviderContext)
  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")
  return context
}
