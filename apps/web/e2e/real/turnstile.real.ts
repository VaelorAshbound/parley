import { test, type APIRequestContext } from "@playwright/test"

import { draftOpened, expect, open } from "../helpers"

// Turnstile (spec §6): Cloudflare's real widget and siteverify. Previews
// and local dev use the "always passes" test keys, so on a PR the widget's
// script, token and server check all run for real, and a request with no
// token is turned away. Production has the real keys: the nightly run sets
// TURNSTILE_REAL_KEYS, and there a made-up token must be refused too.
// Better Auth's captcha plugin answers 400 without a token and 403 when
// siteverify says no.

const realKeys = Boolean(process.env.TURNSTILE_REAL_KEYS)

async function newGuest(
  request: APIRequestContext,
  baseURL: string,
  headers: Record<string, string> = {}
) {
  return request.post("/api/auth/sign-in/anonymous", {
    headers: { origin: new URL(baseURL).origin, ...headers },
    data: {},
  })
}

test("a guest can't be made without a Turnstile token", async ({
  request,
  baseURL,
}) => {
  const response = await newGuest(request, baseURL ?? "")

  expect(response.status()).toBe(400)
})

test("a made-up token is refused where the real keys are set", async ({
  request,
  baseURL,
}) => {
  test.skip(!realKeys, "Only where the real keys are set (TURNSTILE_REAL_KEYS)")

  const response = await newGuest(request, baseURL ?? "", {
    "x-captcha-response": "XXXX.DUMMY.TOKEN.XXXX",
  })

  expect(response.status()).toBe(403)
})

test("the widget checks a visitor in the browser, and the draft starts", async ({
  page,
}) => {
  // With the real keys, a headless browser may get a challenge.
  test.skip(realKeys, "The real widget may challenge a headless browser")
  const widget = page.waitForResponse(/challenges\.cloudflare\.com/)

  await open(page, "/")
  // From the library: a new guest, and no model call.
  await page.getByRole("button", { name: /Mutual NDA/ }).click()

  await widget
  await draftOpened(page)
})
