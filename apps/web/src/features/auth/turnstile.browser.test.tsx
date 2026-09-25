import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { useState } from "react"
import { describe, expect, test, vi } from "vite-plus/test"
import { render } from "vitest-browser-react"

import { ThemeProvider } from "@/components/theme-provider"

import { useTurnstile } from "./turnstile"

// A Turnstile token works once, so after each send the widget must start a
// new check (PAR-11). The real script comes from Cloudflare; this file puts a
// stand-in on `window.turnstile` that hands out numbered tokens, and loads it
// late, as a slow network would.

type Params = { callback: (token: string) => void }

function fakeTurnstile() {
  let issued = 0
  let current: string | undefined
  let params: Params | undefined
  const solve = () =>
    setTimeout(() => {
      current = `token-${++issued}`
      params?.callback(current)
    }, 10)
  return {
    render: vi.fn<(element: HTMLElement, options: Params) => string>(
      (_element, options) => {
        params = options
        solve()
        return "widget-1"
      }
    ),
    getResponse: () => current,
    reset: vi.fn<() => void>(() => {
      current = undefined
      solve()
    }),
    remove: vi.fn<() => void>(),
    isExpired: () => false,
  }
}

/** A form that sends with a Turnstile token and lists the tokens it sent. */
function Form() {
  const turnstile = useTurnstile("1x00000000000000000000AA")
  const [sent, setSent] = useState<string[]>([])
  const send = async () => {
    const headers = await turnstile.headers()
    setSent((all) => [...all, headers?.["x-captcha-response"] ?? "failed"])
  }
  return (
    <>
      {turnstile.widget}
      <button type="button" onClick={() => void send()}>
        Send
      </button>
      <output>{sent.join(" ")}</output>
    </>
  )
}

async function mount() {
  // The script tag is "there" but hasn't run: the library waits for it.
  const script = document.createElement("script")
  script.id = "cf-turnstile-script"
  document.head.appendChild(script)

  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory(),
  })
  await router.load()
  return render(
    <RouterProvider
      router={router}
      defaultComponent={() => (
        <ThemeProvider>
          <Form />
        </ThemeProvider>
      )}
    />
  )
}

describe("useTurnstile", () => {
  test("a send started before the script loads gets a token, and the next send a new one", async () => {
    const screen = await mount()

    // Sent at once, before Cloudflare's script has run.
    await screen.getByRole("button", { name: "Send" }).click()
    const turnstile = fakeTurnstile()
    Object.assign(window, { turnstile })
    ;(
      window as unknown as Record<string, () => void>
    ).onloadTurnstileCallback?.()

    const sent = screen.getByRole("status")
    await expect.element(sent).toHaveTextContent("token-1")
    expect(turnstile.reset).toHaveBeenCalledTimes(1)
    await screen.getByRole("button", { name: "Send" }).click()
    await expect.element(sent).toHaveTextContent("token-1 token-2")
  })
})
