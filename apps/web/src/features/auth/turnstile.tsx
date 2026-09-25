import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile"
import { useRef } from "react"

import { useTheme } from "@/components/theme-provider"

// Cloudflare Turnstile before sign-up, sign-in and email sends (spec §5
// Auth). Managed mode shows nothing to most people, and a check box only
// when Cloudflare isn't sure. The server checks the token through Better
// Auth's captcha plugin, which reads the x-captcha-response header.
// https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/

/** A Turnstile widget and a way to get a fresh token for one request. */
export function useTurnstile(siteKey: string) {
  const ref = useRef<TurnstileInstance>(null)
  const { theme } = useTheme()

  const widget = (
    <Turnstile
      ref={ref}
      siteKey={siteKey}
      options={{
        // One action for every auth form; the server expects it.
        action: "auth",
        appearance: "interaction-only",
        size: "flexible",
        theme: theme === "system" ? "auto" : theme,
      }}
    />
  )

  return {
    widget,
    /**
     * The headers for one auth request, or undefined if the check failed.
     * Waits for the check to finish (up to 30 s). A token works once, so
     * the widget starts a new check straight after.
     */
    async headers() {
      const turnstile = ref.current
      if (!turnstile) return undefined
      try {
        return { "x-captcha-response": await turnstile.getResponsePromise() }
      } catch {
        return undefined
      } finally {
        turnstile.reset()
      }
    },
  }
}
