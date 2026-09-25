import { ORPCError, safe } from "@orpc/client"
import { schema } from "@workspace/db"
import { and, eq } from "drizzle-orm"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  browserClient,
  call,
  cookiesFrom,
  database,
  origin,
  post,
} from "./helpers"
import { fakeResend } from "./resend"

// Account settings (spec §5 Auth, T23), through the real /api app: what the
// settings page calls on Better Auth, and the audit lines they leave.

let resend: ReturnType<typeof fakeResend> | undefined
afterEach(() => resend?.restore())

const password = "correct horse 1"
const newPassword = "battery staple 2"

/** A new account, signed in; `email` on a test domain sends no email. */
async function signUp(email = `ana-${crypto.randomUUID()}@example.test`) {
  const response = await post("/api/auth/sign-up/email", {
    name: "Ana",
    email,
    password,
  })
  expect(response.status).toBe(200)
  const { user } = await response.json<{ user: { id: string } }>()
  return { email, userId: user.id, cookie: cookiesFrom(response) }
}

/** The same account, signed in on a second device. */
async function signIn(email: string, pass = password) {
  const response = await post("/api/auth/sign-in/email", {
    email,
    password: pass,
  })
  return { status: response.status, cookie: cookiesFrom(response) }
}

/** The session behind a cookie, read from the database. */
async function session(cookie: string) {
  const response = await call("/api/auth/get-session?disableCookieCache=true", {
    headers: { cookie },
  })
  return response.json<{
    user: { name: string; email: string; emailVerified: boolean }
  } | null>()
}

/** The audit lines written while `run` runs. */
async function audited<T>(run: () => Promise<T>) {
  using info = vi.spyOn(console, "log").mockImplementation(() => {})
  const result = await run()
  const lines = info.mock.calls.map(([line]) => line as { event?: string })
  return { result, lines }
}

describe("changing the password", () => {
  it("needs the current password", async () => {
    const ana = await signUp()

    const response = await post(
      "/api/auth/change-password",
      { currentPassword: "not my password", newPassword },
      ana.cookie
    )

    expect(response.status).toBe(400)
    expect((await signIn(ana.email)).status).toBe(200)
  })

  it("changes it, and writes an audit line", async () => {
    const ana = await signUp()

    const { result, lines } = await audited(() =>
      post(
        "/api/auth/change-password",
        { currentPassword: password, newPassword },
        ana.cookie
      )
    )

    expect(result.status).toBe(200)
    expect((await signIn(ana.email, newPassword)).status).toBe(200)
    expect(lines).toContainEqual(
      expect.objectContaining({ event: "password_changed", userId: ana.userId })
    )
  })

  it("can sign every other device out, and keeps this one", async () => {
    const ana = await signUp()
    const phone = await signIn(ana.email)

    const response = await post(
      "/api/auth/change-password",
      { currentPassword: password, newPassword, revokeOtherSessions: true },
      ana.cookie
    )

    expect(await session(phone.cookie)).toBeNull()
    // This device gets a new session cookie with the answer.
    expect(await session(cookiesFrom(response))).not.toBeNull()
  })
})

describe("changing the name", () => {
  it("saves the new name", async () => {
    const ana = await signUp()

    const response = await post(
      "/api/auth/update-user",
      { name: "Ana María" },
      ana.cookie
    )

    expect(response.status).toBe(200)
    expect(await session(ana.cookie)).toMatchObject({
      user: { name: "Ana María" },
    })
  })

  it("can't change the email that way", async () => {
    const ana = await signUp()

    const response = await post(
      "/api/auth/update-user",
      { email: "someone-else@acme.dev" },
      ana.cookie
    )

    expect(response.status).toBe(400)
    expect(await session(ana.cookie)).toMatchObject({
      user: { email: ana.email },
    })
  })
})

/** Makes the account one that signs in with Google or GitHub only. */
async function withoutPassword(userId: string) {
  const db = await database()
  await db
    .delete(schema.account)
    .where(
      and(
        eq(schema.account.userId, userId),
        eq(schema.account.providerId, "credential")
      )
    )
  await db.insert(schema.account).values({
    id: crypto.randomUUID(),
    userId,
    providerId: "github",
    accountId: `github-${userId}`,
  })
}

/** Moves the user's sessions' start back, as if signed in long ago. */
async function signedInLongAgo(userId: string) {
  const db = await database()
  await db
    .update(schema.session)
    .set({ createdAt: new Date(Date.now() - 60 * 60 * 1000) })
    .where(eq(schema.session.userId, userId))
}

function codeOf(error: unknown) {
  return error instanceof ORPCError ? error.code : error
}

describe("account.get", () => {
  it("says how the user signs in", async () => {
    const ana = await signUp()

    const account = await browserClient(ana.cookie).account.get()

    expect(account).toEqual({
      hasPassword: true,
      providers: [],
      freshUntil: expect.any(Date),
    })
  })

  it("knows an account with Google or GitHub only has no password", async () => {
    const ana = await signUp()
    await withoutPassword(ana.userId)

    const account = await browserClient(ana.cookie).account.get()

    expect(account).toMatchObject({ hasPassword: false, providers: ["github"] })
  })

  it("is for accounts, not guests", async () => {
    const guest = await post("/api/auth/sign-in/anonymous", {})

    const { error } = await safe(
      browserClient(cookiesFrom(guest)).account.get()
    )

    expect(codeOf(error)).toBe("UNAUTHORIZED")
  })
})

describe("account.sessions", () => {
  it("lists each signed-in device, marks this one, and shows no tokens", async () => {
    const ana = await signUp()
    const phone = await signIn(ana.email)

    const sessions = await browserClient(ana.cookie).account.sessions()

    expect(sessions).toHaveLength(2)
    expect(sessions.filter((each) => each.current)).toHaveLength(1)
    expect(Object.keys(sessions[0] ?? {}).toSorted()).toEqual([
      "createdAt",
      "current",
      "device",
      "id",
      "lastActiveAt",
    ])
    const text = JSON.stringify(sessions)
    for (const cookie of [ana.cookie, phone.cookie]) {
      const token = cookie.match(/session_token=([^.;]+)/)?.[1] ?? "missing"
      expect(text).not.toContain(token)
    }
  })
})

describe("account.revokeSession", () => {
  it("signs another device out, and writes an audit line", async () => {
    const ana = await signUp()
    const phone = await signIn(ana.email)
    const client = browserClient(ana.cookie)
    const other = (await client.account.sessions()).find(
      (each) => !each.current
    )

    const { lines } = await audited(() =>
      client.account.revokeSession({ id: other?.id ?? "" })
    )

    expect(await session(phone.cookie)).toBeNull()
    expect(await session(ana.cookie)).not.toBeNull()
    expect(lines).toContainEqual(
      expect.objectContaining({ event: "session_ended", userId: ana.userId })
    )
  })

  it("can't sign someone else out", async () => {
    const ana = await signUp()
    const bo = await signUp()
    const [boSession] = await browserClient(bo.cookie).account.sessions()

    const { error } = await safe(
      browserClient(ana.cookie).account.revokeSession({
        id: boSession?.id ?? "",
      })
    )

    expect(codeOf(error)).toBe("NOT_FOUND")
    expect(await session(bo.cookie)).not.toBeNull()
  })
})

describe("account.setPassword", () => {
  it("lets a Google or GitHub account add a password", async () => {
    const ana = await signUp()
    await withoutPassword(ana.userId)

    await browserClient(ana.cookie).account.setPassword({ newPassword })

    expect((await signIn(ana.email, newPassword)).status).toBe(200)
  })

  it("asks to sign in again when the session is old", async () => {
    const ana = await signUp()
    await withoutPassword(ana.userId)
    await signedInLongAgo(ana.userId)

    const { error } = await safe(
      browserClient(ana.cookie).account.setPassword({ newPassword })
    )

    expect(codeOf(error)).toBe("SESSION_NOT_FRESH")
    expect((await signIn(ana.email, newPassword)).status).toBe(401)
  })

  it("never replaces a password that is already set", async () => {
    const ana = await signUp()

    const { error } = await safe(
      browserClient(ana.cookie).account.setPassword({ newPassword })
    )

    expect(codeOf(error)).toBe("PASSWORD_ALREADY_SET")
    expect((await signIn(ana.email)).status).toBe(200)
  })

  it("refuses a password shorter than 10 characters", async () => {
    const ana = await signUp()
    await withoutPassword(ana.userId)

    const { error } = await safe(
      browserClient(ana.cookie).account.setPassword({ newPassword: "short" })
    )

    expect(codeOf(error)).toBe("BAD_REQUEST")
  })
})

describe("changing the email", () => {
  // Real-looking domains, so the mailer sends (to the fake Resend).
  const address = () => `ana-${crypto.randomUUID()}@acme.dev`

  /** Opens a link from an email, in the browser with this cookie. */
  async function open(link: URL, cookie?: string) {
    return call(link.pathname + link.search, {
      headers: cookie ? { cookie } : {},
      redirect: "manual",
    })
  }

  /** A signed-up account whose email is confirmed. */
  async function confirmedAccount() {
    resend = fakeResend()
    const ana = await signUp(address())
    await open(resend.linkFor(ana.email), ana.cookie)
    expect(await session(ana.cookie)).toMatchObject({
      user: { emailVerified: true },
    })
    return ana
  }

  /** Where the links land, as the settings page asks (afterEmailLink). */
  const settingsFor = (newEmail: string) =>
    `/settings?${new URLSearchParams({ email: newEmail })}`

  function changeEmail(cookie: string, newEmail: string) {
    return post(
      "/api/auth/change-email",
      { newEmail, callbackURL: origin + settingsFor(newEmail) },
      cookie
    )
  }

  it("asks the current address to approve, then the new one to confirm", async () => {
    const ana = await confirmedAccount()
    const newEmail = address()

    const response = await changeEmail(ana.cookie, newEmail)

    expect(response.status).toBe(200)
    expect(resend?.sent.at(-1)).toMatchObject({
      to: ana.email,
      subject: "Approve your new email for Parley",
    })
    expect(resend?.sent.at(-1)?.text).toContain(newEmail)

    // The approval sends the confirmation to the new address.
    await open(resend?.linkFor(ana.email) ?? new URL(origin), ana.cookie)
    expect(resend?.sent.at(-1)).toMatchObject({
      to: newEmail,
      subject: "Confirm your email for Parley",
    })
    expect(await session(ana.cookie)).toMatchObject({
      user: { email: ana.email },
    })

    const { lines } = await audited(() =>
      open(resend?.linkFor(newEmail) ?? new URL(origin), ana.cookie)
    )
    expect(await session(ana.cookie)).toMatchObject({
      user: { email: newEmail, emailVerified: true },
    })
    expect(lines).toContainEqual(
      expect.objectContaining({ event: "email_changed", userId: ana.userId })
    )
  })

  it("sends an unconfirmed account's link straight to the new address", async () => {
    resend = fakeResend()
    const ana = await signUp(address())
    const newEmail = address()

    await changeEmail(ana.cookie, newEmail)
    expect(resend.sent.at(-1)).toMatchObject({ to: newEmail })
    await open(resend.linkFor(newEmail), ana.cookie)

    expect(await session(ana.cookie)).toMatchObject({
      user: { email: newEmail, emailVerified: true },
    })
  })

  // It sends email to any address typed in (for an unconfirmed account),
  // so a bot must not be able to use it to send spam.
  it("needs a solved Turnstile challenge", async () => {
    resend = fakeResend()
    const ana = await signUp(address())
    const sent = resend.sent.length

    const response = await call("/api/auth/change-email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: ana.cookie,
        "x-captcha-response": "",
      },
      body: JSON.stringify({
        newEmail: address(),
        callbackURL: origin + settingsFor(ana.email),
      }),
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: "MISSING_RESPONSE" })
    expect(resend.sent.length).toBe(sent)
  })

  it("answers the same for an address that has an account, and sends nothing", async () => {
    const ana = await confirmedAccount()
    const bo = await signUp(address())
    const sent = resend?.sent.length

    const response = await changeEmail(ana.cookie, bo.email)

    expect(response.status).toBe(200)
    expect(resend?.sent.length).toBe(sent)
  })

  // Better Auth's last link signs in a browser with no session. Anyone who
  // gets it could sign a stranger in to their own account and collect what
  // the stranger types there (login CSRF, as T21 found for the confirm
  // link), and a mistyped new address would get the account.
  it("needs the account signed in to open the new address's link", async () => {
    const ana = await confirmedAccount()
    const newEmail = address()
    await changeEmail(ana.cookie, newEmail)
    await open(resend?.linkFor(ana.email) ?? new URL(origin), ana.cookie)
    const link = resend?.linkFor(newEmail) ?? new URL(origin)

    const elsewhere = await open(link)

    expect(elsewhere.status).toBe(302)
    expect(elsewhere.headers.get("location")).toBe(
      `${settingsFor(newEmail)}&error=SIGN_IN_FIRST`
    )
    expect(cookiesFrom(elsewhere)).not.toContain("session_token=")
    expect(await session(ana.cookie)).toMatchObject({
      user: { email: ana.email },
    })
    // Signed in, the same link still works.
    await open(link, ana.cookie)
    expect(await session(ana.cookie)).toMatchObject({
      user: { email: newEmail },
    })
  })

  it("does nothing when the link is opened by someone else who is signed in", async () => {
    const ana = await confirmedAccount()
    const newEmail = address()
    await changeEmail(ana.cookie, newEmail)
    const approval = resend?.linkFor(ana.email) ?? new URL(origin)
    const bo = await signUp()

    const response = await open(approval, bo.cookie)

    expect(response.headers.get("location")).toContain("error=")
    expect(resend?.sent.at(-1)?.to).toBe(ana.email)
  })
})

describe("deleting the account", () => {
  /** Every row that holds the user's data, by table. */
  async function rowsOf(userId: string) {
    const db = await database()
    const count = async (rows: Promise<unknown[]>) => (await rows).length
    return {
      user: await count(
        db.select().from(schema.user).where(eq(schema.user.id, userId))
      ),
      sessions: await count(
        db
          .select()
          .from(schema.session)
          .where(eq(schema.session.userId, userId))
      ),
      accounts: await count(
        db
          .select()
          .from(schema.account)
          .where(eq(schema.account.userId, userId))
      ),
      drafts: await count(
        db.select().from(schema.draft).where(eq(schema.draft.userId, userId))
      ),
    }
  }

  const gone = { user: 0, sessions: 0, accounts: 0, drafts: 0 }

  it("removes the account and all its data, after the password", async () => {
    const ana = await signUp()
    await browserClient(ana.cookie).drafts.create({
      documentId: "mutual-nda",
      today: "2026-09-25",
    })

    const { result, lines } = await audited(() =>
      post("/api/auth/delete-user", { password }, ana.cookie)
    )

    expect(result.status).toBe(200)
    expect(await rowsOf(ana.userId)).toEqual(gone)
    expect(lines).toContainEqual(
      expect.objectContaining({
        event: "user_deleted",
        userId: ana.userId,
        guest: false,
      })
    )
  })

  it("keeps everything when the password is wrong", async () => {
    const ana = await signUp()

    const response = await post(
      "/api/auth/delete-user",
      { password: "not my password" },
      ana.cookie
    )

    expect(response.status).toBe(400)
    expect((await rowsOf(ana.userId)).user).toBe(1)
  })

  // Better Auth alone would take a fresh session instead: anyone at the
  // user's browser in the 15 minutes after sign-in could delete it.
  it("always needs the password of an account that has one", async () => {
    const ana = await signUp()

    const response = await post("/api/auth/delete-user", {}, ana.cookie)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: "INVALID_PASSWORD" })
    expect(await rowsOf(ana.userId)).toMatchObject({ user: 1, accounts: 1 })
  })

  it("lets a Google or GitHub account delete itself right after signing in", async () => {
    const ana = await signUp()
    await withoutPassword(ana.userId)

    const response = await post("/api/auth/delete-user", {}, ana.cookie)

    expect(response.status).toBe(200)
    expect(await rowsOf(ana.userId)).toEqual(gone)
  })

  it("asks a Google or GitHub account to sign in again when the session is old", async () => {
    const ana = await signUp()
    await withoutPassword(ana.userId)
    await signedInLongAgo(ana.userId)

    const response = await post("/api/auth/delete-user", {}, ana.cookie)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: "SESSION_EXPIRED" })
    expect((await rowsOf(ana.userId)).user).toBe(1)
  })
})
