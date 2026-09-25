import { afterEach, describe, expect, it, vi } from "vitest"

import { call, cookiesFrom, serverClient, signInGuest } from "./helpers"
import { fakeResend } from "./resend"

// Signing in with GitHub (Google works the same way in Better Auth): a
// guest keeps their draft, the "last used" method is remembered, and an
// account is joined only when both sides confirmed the email (spec §5 Auth).
// GitHub's OAuth and API endpoints are faked at the network edge.

const today = "2026-09-25"

type GitHubUser = { id: number; email: string; verified: boolean }

let restore: (() => void)[] = []
afterEach(() => {
  for (const each of restore) each()
  restore = []
})

function fakeGitHub(user: GitHubUser) {
  const realFetch = globalThis.fetch
  const spy = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url.startsWith("https://github.com/login/oauth/access_token"))
        return Response.json({
          access_token: "gho_test",
          token_type: "bearer",
          scope: "read:user,user:email",
        })
      if (url === "https://api.github.com/user")
        return Response.json({
          id: user.id,
          login: "ana",
          name: "Ana",
          email: null,
          avatar_url: "https://avatars.githubusercontent.com/u/1",
        })
      if (url === "https://api.github.com/user/emails")
        return Response.json([
          { email: user.email, primary: true, verified: user.verified },
        ])
      return realFetch(input, init)
    })
  restore.push(() => spy.mockRestore())
}

function newGitHubUser(email = `ana-${crypto.randomUUID()}@acme.dev`) {
  return { id: Math.floor(Math.random() * 1e9), email, verified: true }
}

/** The browser's round trip: start, GitHub says yes, the callback. */
async function signInWithGitHub(user: GitHubUser, cookie?: string) {
  fakeGitHub(user)
  const start = await call("/api/auth/sign-in/social", {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie && { cookie }) },
    body: JSON.stringify({ provider: "github", callbackURL: "/" }),
  })
  expect(start.status).toBe(200)
  const { url } = (await start.json()) as { url: string }
  const state = new URL(url).searchParams.get("state") ?? ""
  const cookies = [cookie, cookiesFrom(start)].filter(Boolean).join("; ")
  return call(
    `/api/auth/callback/github?code=test-code&state=${encodeURIComponent(state)}`,
    { headers: { cookie: cookies }, redirect: "manual" }
  )
}

async function whoIs(cookie: string) {
  const response = await call("/api/auth/get-session", { headers: { cookie } })
  return (await response.json()) as {
    user: { id: string; email: string; isAnonymous?: boolean | null }
  } | null
}

async function signUp(email: string) {
  // Both fakes wrap fetch, so this one is gone before GitHub's comes.
  const resend = fakeResend()
  try {
    const response = await call("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Ana", email, password: "correct horse 1" }),
    })
    expect(response.status).toBe(200)
    return { cookie: cookiesFrom(response), link: resend.linkFor(email) }
  } finally {
    resend.restore()
  }
}

describe("signing in with GitHub", () => {
  it("makes an account and signs the user in", async () => {
    const user = newGitHubUser()

    const response = await signInWithGitHub(user)

    expect(response.status).toBe(302)
    expect(await whoIs(cookiesFrom(response))).toMatchObject({
      user: { email: user.email },
    })
  })

  it("lets a guest keep their draft", async () => {
    const guest = await signInGuest()
    const draft = await (
      await serverClient(guest.cookie)
    ).drafts.create({ documentId: "mutual-nda", today })

    const response = await signInWithGitHub(newGitHubUser(), guest.cookie)

    const account = await serverClient(cookiesFrom(response))
    expect(await account.drafts.get({ id: draft.id })).toMatchObject({
      id: draft.id,
    })
    expect((await whoIs(cookiesFrom(response)))?.user.isAnonymous).not.toBe(
      true
    )
  })

  it("remembers GitHub as the last method used", async () => {
    const response = await signInWithGitHub(newGitHubUser())

    expect(cookiesFrom(response)).toContain("last_used_login_method=github")
  })

  it("joins the account that has the same confirmed email", async () => {
    const email = `ana-${crypto.randomUUID()}@acme.dev`
    const { cookie, link } = await signUp(email)
    await call(link.pathname + link.search, { redirect: "manual" })
    const owner = await whoIs(cookie)

    const response = await signInWithGitHub(newGitHubUser(email))

    expect((await whoIs(cookiesFrom(response)))?.user.id).toBe(owner?.user.id)
  })

  it("never joins an account whose email isn't confirmed yet", async () => {
    // Someone signed up with Ana's address first, without the inbox. Joining
    // would let them into the account Ana then uses with GitHub.
    const email = `ana-${crypto.randomUUID()}@acme.dev`
    await signUp(email)

    const response = await signInWithGitHub(newGitHubUser(email))

    expect(response.headers.get("location")).toContain(
      "error=account_not_linked"
    )
    expect(cookiesFrom(response)).not.toContain("session_token=")
  })
})

describe("signing up with email", () => {
  it("remembers email as the last method used", async () => {
    const { cookie } = await signUp(`ana-${crypto.randomUUID()}@acme.dev`)

    expect(cookie).toContain("last_used_login_method=email")
  })
})
