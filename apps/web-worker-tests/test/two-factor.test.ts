import { schema } from "@workspace/db"
import { and, eq, like } from "drizzle-orm"
import { describe, expect, it, vi } from "vitest"

import { totp } from "../../web/src/test/totp"
import {
  auditEvents,
  browserClient,
  call,
  cookiesFrom,
  database,
  post,
  randomIp,
  serverClient,
  signInGuest,
} from "./helpers"

// Two-factor sign-in (spec §5 Auth, T23b), through the real /api app as the
// settings page and the /two-factor page call it. Codes come from the QR
// code's URI, as an authenticator app makes them (web/src/test/totp.ts).

const password = "correct horse 1"
const today = "2026-09-26"

/** A new account, signed in; `email` on a test domain sends no email. */
async function signUp() {
  const email = `ana-${crypto.randomUUID()}@example.test`
  const response = await post("/api/auth/sign-up/email", {
    name: "Ana",
    email,
    password,
  })
  expect(response.status).toBe(200)
  const { user } = await response.json<{ user: { id: string } }>()
  return { email, userId: user.id, cookie: cookiesFrom(response) }
}

type Account = Awaited<ReturnType<typeof signUp>>

/** Settings → Two-factor → Turn on: the password, then the QR code. */
async function enable(account: Account) {
  const response = await post(
    "/api/auth/two-factor/enable",
    { password },
    account.cookie
  )
  expect(response.status).toBe(200)
  return response.json<{ totpURI: string; backupCodes: string[] }>()
}

/**
 * Turns two-factor sign-in on: the password, then the first code from the
 * app. Checking the code starts a new session; its cookie is returned.
 */
async function turnOn(account: Account) {
  const { totpURI, backupCodes } = await enable(account)
  const response = await post(
    "/api/auth/two-factor/verify-totp",
    { code: await totp(totpURI) },
    account.cookie
  )
  expect(response.status).toBe(200)
  return { uri: totpURI, backupCodes, cookie: cookiesFrom(response) }
}

/** The password step of signing in, from a browser with `cookie`. */
function signIn(email: string, cookie?: string) {
  return post("/api/auth/sign-in/email", { email, password }, cookie)
}

/** Who a cookie is signed in as, from the database. */
async function sessionUser(cookie: string) {
  const response = await call("/api/auth/get-session?disableCookieCache=true", {
    headers: { cookie },
  })
  const body = await response.json<{
    user: { id: string; twoFactorEnabled: boolean }
  } | null>()
  return body?.user ?? null
}

/** The audit lines written while `run` runs. */
async function audited<T>(run: () => Promise<T>) {
  using info = vi.spyOn(console, "log").mockImplementation(() => {})
  const result = await run()
  const lines = info.mock.calls
    .map(([line]) => line as { event?: string })
    .filter((line) => auditEvents.has(line.event ?? ""))
  return { result, lines }
}

describe("turning two-factor sign-in on", () => {
  it("needs the password", async () => {
    const ana = await signUp()

    const response = await post(
      "/api/auth/two-factor/enable",
      { password: "not my password" },
      ana.cookie
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: "INVALID_PASSWORD" })
  })

  it("gives a QR code for Parley and 10 backup codes", async () => {
    const ana = await signUp()

    const { totpURI, backupCodes } = await enable(ana)

    const uri = new URL(totpURI)
    expect(uri.protocol).toBe("otpauth:")
    expect(uri.searchParams.get("issuer")).toBe("Parley")
    expect(decodeURIComponent(uri.pathname)).toContain(ana.email)
    expect(backupCodes).toHaveLength(10)
    expect(new Set(backupCodes).size).toBe(10)
  })

  it("isn't on until the first code from the app is right", async () => {
    const ana = await signUp()
    await enable(ana)

    const wrong = await post(
      "/api/auth/two-factor/verify-totp",
      { code: "000000" },
      ana.cookie
    )

    expect(wrong.status).toBe(401)
    expect(await sessionUser(ana.cookie)).toMatchObject({
      twoFactorEnabled: false,
    })
    expect(
      await signIn(ana.email).then((each) => each.json())
    ).not.toHaveProperty("twoFactorRedirect")
  })

  it("is on after the first code, and writes an audit line", async () => {
    const ana = await signUp()
    const { totpURI } = await enable(ana)

    const { result, lines } = await audited(async () =>
      post(
        "/api/auth/two-factor/verify-totp",
        { code: await totp(totpURI) },
        ana.cookie
      )
    )

    expect(result.status).toBe(200)
    expect(await sessionUser(cookiesFrom(result))).toMatchObject({
      twoFactorEnabled: true,
    })
    expect(lines).toContainEqual(
      expect.objectContaining({ event: "two_factor_on", userId: ana.userId })
    )
  })

  it("can't be done for a guest", async () => {
    const guest = await signInGuest()

    const response = await post(
      "/api/auth/two-factor/enable",
      { password },
      guest.cookie
    )

    expect(response.status).toBe(400)
  })

  it("shows on the settings page", async () => {
    const ana = await signUp()
    const before = await browserClient(ana.cookie).account.get()
    const { cookie } = await turnOn(ana)

    const after = await browserClient(cookie).account.get()

    expect(before.twoFactor).toBe(false)
    expect(after.twoFactor).toBe(true)
  })
})

describe("signing in with two-factor on", () => {
  it("asks for a code after the password, and gives no session yet", async () => {
    const ana = await signUp()
    await turnOn(ana)

    const response = await signIn(ana.email)

    expect(await response.json()).toMatchObject({ twoFactorRedirect: true })
    expect(await sessionUser(cookiesFrom(response))).toBeNull()
  })

  it("signs in with the code from the app", async () => {
    const ana = await signUp()
    const { uri } = await turnOn(ana)
    const challenge = cookiesFrom(await signIn(ana.email))

    const response = await post(
      "/api/auth/two-factor/verify-totp",
      { code: await totp(uri) },
      challenge
    )

    expect(response.status).toBe(200)
    expect(await sessionUser(cookiesFrom(response))).toMatchObject({
      id: ana.userId,
    })
  })

  it("refuses a wrong code", async () => {
    const ana = await signUp()
    const { uri } = await turnOn(ana)
    const challenge = cookiesFrom(await signIn(ana.email))
    const right = await totp(uri)
    const wrong = String((Number(right) + 1) % 1_000_000).padStart(6, "0")

    const response = await post(
      "/api/auth/two-factor/verify-totp",
      { code: wrong },
      challenge
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ code: "INVALID_CODE" })
    expect(await sessionUser(cookiesFrom(response))).toBeNull()
  })

  it("takes a backup code once", async () => {
    const ana = await signUp()
    const { backupCodes } = await turnOn(ana)
    const [code] = backupCodes

    const first = await post(
      "/api/auth/two-factor/verify-backup-code",
      { code },
      cookiesFrom(await signIn(ana.email))
    )
    const again = await post(
      "/api/auth/two-factor/verify-backup-code",
      { code },
      cookiesFrom(await signIn(ana.email))
    )

    expect(first.status).toBe(200)
    expect(await sessionUser(cookiesFrom(first))).toMatchObject({
      id: ana.userId,
    })
    expect(again.status).toBe(401)
    expect(await again.json()).toMatchObject({ code: "INVALID_BACKUP_CODE" })
  })

  it("tells a guest's session it has no code to check (PAR-20)", async () => {
    // A guest on /two-factor: the page names TOTP_NOT_ENABLED.
    const guest = await signInGuest()

    const response = await post(
      "/api/auth/two-factor/verify-totp",
      { code: "123456" },
      guest.cookie
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: "TOTP_NOT_ENABLED" })
  })

  it("allows 3 codes per 10 seconds per network, as the page says (PAR-20)", async () => {
    const ana = await signUp()
    await turnOn(ana)
    const challenge = cookiesFrom(await signIn(ana.email))
    const ip = randomIp()
    const send = () =>
      call("/api/auth/two-factor/verify-totp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": ip,
          cookie: challenge,
        },
        body: JSON.stringify({ code: "000000" }),
      })

    const statuses = []
    for (let each = 0; each < 3; each++) statuses.push((await send()).status)
    const limited = await send()

    expect(statuses).not.toContain(429)
    expect(limited.status).toBe(429)
    // messages.ts: "Please wait 10 seconds".
    expect(Number(limited.headers.get("x-retry-after"))).toBeLessThanOrEqual(10)
  })

  it("skips the code on a device trusted for 30 days", async () => {
    const ana = await signUp()
    const { uri } = await turnOn(ana)
    const verified = await post(
      "/api/auth/two-factor/verify-totp",
      { code: await totp(uri), trustDevice: true },
      cookiesFrom(await signIn(ana.email))
    )
    const trust = trustCookie(verified)

    const response = await signIn(ana.email, trust)

    expect(trust).toContain("trust_device=")
    expect(maxAge(verified, "trust_device")).toBe(30 * 24 * 60 * 60)
    expect(await response.json()).not.toHaveProperty("twoFactorRedirect")
    expect(await sessionUser(cookiesFrom(response))).toMatchObject({
      id: ana.userId,
    })
  })
})

describe("turning two-factor sign-in off", () => {
  it("needs the password", async () => {
    const ana = await signUp()
    const { cookie } = await turnOn(ana)

    const response = await post(
      "/api/auth/two-factor/disable",
      { password: "not my password" },
      cookie
    )

    expect(response.status).toBe(400)
    expect(await signIn(ana.email).then((each) => each.json())).toMatchObject({
      twoFactorRedirect: true,
    })
  })

  it("signs in with the password alone again, and writes an audit line", async () => {
    const ana = await signUp()
    const { cookie } = await turnOn(ana)

    const { result, lines } = await audited(() =>
      post("/api/auth/two-factor/disable", { password }, cookie)
    )

    expect(result.status).toBe(200)
    expect(
      await signIn(ana.email).then((each) => each.json())
    ).not.toHaveProperty("twoFactorRedirect")
    expect(lines).toContainEqual(
      expect.objectContaining({ event: "two_factor_off", userId: ana.userId })
    )
  })

  it("forgets every trusted device, not only this one", async () => {
    const ana = await signUp()
    const first = await turnOn(ana)
    // A laptop trusted to skip the code, then two-factor off and on again
    // from another device.
    const laptop = trustCookie(
      await post(
        "/api/auth/two-factor/verify-totp",
        { code: await totp(first.uri), trustDevice: true },
        cookiesFrom(await signIn(ana.email))
      )
    )
    await post("/api/auth/two-factor/disable", { password }, first.cookie)
    const phone = await signIn(ana.email)
    await turnOn({ ...ana, cookie: cookiesFrom(phone) })

    const response = await signIn(ana.email, laptop)

    expect(await response.json()).toMatchObject({ twoFactorRedirect: true })
    const db = await database()
    const trusted = await db
      .select()
      .from(schema.verification)
      .where(
        and(
          eq(schema.verification.value, ana.userId),
          like(schema.verification.identifier, "trust-device-%")
        )
      )
    expect(trusted).toEqual([])
  })
})

describe("trusted devices after a new password (PAR-20)", () => {
  /** A laptop trusted to skip the code: its trust cookie. */
  async function trustedLaptop(email: string, uri: string) {
    return trustCookie(
      await post(
        "/api/auth/two-factor/verify-totp",
        { code: await totp(uri), trustDevice: true },
        cookiesFrom(await signIn(email))
      )
    )
  }

  /** Signing in from a device that may be trusted, with a password. */
  function signInWith(email: string, secret: string, cookie: string) {
    return post("/api/auth/sign-in/email", { email, password: secret }, cookie)
  }

  it("are forgotten when the password is reset", async () => {
    const ana = await signUp()
    const db = await database()
    // A confirmed email: an unconfirmed one is claimed on reset, which
    // already drops two-factor and its devices.
    await db
      .update(schema.user)
      .set({ emailVerified: true })
      .where(eq(schema.user.id, ana.userId))
    const { uri } = await turnOn(ana)
    const laptop = await trustedLaptop(ana.email, uri)
    await post("/api/auth/request-password-reset", {
      email: ana.email,
      redirectTo: "/reset-password",
    })
    const [row] = await db
      .select({ identifier: schema.verification.identifier })
      .from(schema.verification)
      .where(
        and(
          eq(schema.verification.value, ana.userId),
          like(schema.verification.identifier, "reset-password:%")
        )
      )
    const token = row?.identifier.replace("reset-password:", "") ?? ""

    const reset = await post("/api/auth/reset-password", {
      token,
      newPassword: "battery staple 2",
    })

    expect(reset.status).toBe(200)
    const response = await signInWith(ana.email, "battery staple 2", laptop)
    expect(await response.json()).toMatchObject({ twoFactorRedirect: true })
  })

  it("are forgotten when a password change signs the other devices out", async () => {
    const ana = await signUp()
    const { uri, cookie } = await turnOn(ana)
    const laptop = await trustedLaptop(ana.email, uri)

    const change = await post(
      "/api/auth/change-password",
      {
        currentPassword: password,
        newPassword: "battery staple 2",
        revokeOtherSessions: true,
      },
      cookie
    )

    expect(change.status).toBe(200)
    const response = await signInWith(ana.email, "battery staple 2", laptop)
    expect(await response.json()).toMatchObject({ twoFactorRedirect: true })
  })

  it("stay trusted when a password change keeps the other devices", async () => {
    const ana = await signUp()
    const { uri, cookie } = await turnOn(ana)
    const laptop = await trustedLaptop(ana.email, uri)

    await post(
      "/api/auth/change-password",
      {
        currentPassword: password,
        newPassword: "battery staple 2",
        revokeOtherSessions: false,
      },
      cookie
    )

    const response = await signInWith(ana.email, "battery staple 2", laptop)
    expect(await response.json()).not.toHaveProperty("twoFactorRedirect")
  })
})

describe("the guest carried through the code step (PAR-20)", () => {
  /** A guest with a draft starts signing in to `email`: the carried cookie. */
  async function carriedGuest(email: string) {
    const guest = await signInGuest()
    const client = await serverClient(guest.cookie)
    const draft = await client.drafts.create({
      documentId: "mutual-nda",
      today,
    })
    const challenge = await signIn(email, guest.cookie)
    const carried = cookiesFrom(challenge)
      .split("; ")
      .filter((cookie) => cookie.includes("guest_carried="))
      .join("; ")
    expect(carried).toContain("guest_carried=")
    return { draft, carried }
  }

  async function draftOwner(id: string) {
    const db = await database()
    const [row] = await db
      .select({ userId: schema.draft.userId })
      .from(schema.draft)
      .where(eq(schema.draft.id, id))
    return row?.userId
  }

  it("is let go by any new session", async () => {
    const ana = await signUp()
    await turnOn(ana)
    const { carried } = await carriedGuest(ana.email)
    // Someone else signs in on this browser, to an account without a code.
    const ben = await signUp()

    const response = await signIn(ben.email, carried)

    expect(response.status).toBe(200)
    expect(maxAge(response, "guest_carried")).toBe(0)
  })

  it("never hands one person's work to the next person's account", async () => {
    const ana = await signUp()
    await turnOn(ana)
    const { draft, carried } = await carriedGuest(ana.email)
    // Ana walks away; Ben, signed out, signs in on this browser to his own
    // account with two-factor on.
    const ben = await signUp()
    const benCodes = await turnOn(ben)
    const challenge = await signIn(ben.email, carried)

    const response = await post(
      "/api/auth/two-factor/verify-totp",
      { code: await totp(benCodes.uri) },
      jarAfter(carried, challenge)
    )

    expect(response.status).toBe(200)
    expect(await draftOwner(draft.id)).not.toBe(ben.userId)
  })
})

describe("a guest who signs in to an account with two-factor on", () => {
  async function guestWithDraft() {
    const guest = await signInGuest()
    const client = await serverClient(guest.cookie)
    const draft = await client.drafts.create({
      documentId: "mutual-nda",
      today,
    })
    return { ...guest, draft }
  }

  async function draftOwner(id: string) {
    const db = await database()
    const [row] = await db
      .select({ userId: schema.draft.userId })
      .from(schema.draft)
      .where(eq(schema.draft.id, id))
    return row?.userId
  }

  it("keeps their draft only once the code is right", async () => {
    const ana = await signUp()
    const { uri } = await turnOn(ana)
    const guest = await guestWithDraft()

    const challenge = cookiesFrom(await signIn(ana.email, guest.cookie))

    // The password alone moves nothing.
    expect(await draftOwner(guest.draft.id)).toBe(guest.draft.userId)
    const response = await post(
      "/api/auth/two-factor/verify-totp",
      { code: await totp(uri) },
      challenge
    )
    expect(response.status).toBe(200)
    expect(await draftOwner(guest.draft.id)).toBe(ana.userId)
    const db = await database()
    const guests = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, guest.draft.userId))
    expect(guests).toEqual([])
  })

  it("keeps their draft with a backup code too", async () => {
    const ana = await signUp()
    const { backupCodes } = await turnOn(ana)
    const guest = await guestWithDraft()
    const challenge = cookiesFrom(await signIn(ana.email, guest.cookie))

    await post(
      "/api/auth/two-factor/verify-backup-code",
      { code: backupCodes[0] },
      challenge
    )

    expect(await draftOwner(guest.draft.id)).toBe(ana.userId)
  })

  it("keeps their draft on a trusted device, which needs no code", async () => {
    const ana = await signUp()
    const { uri } = await turnOn(ana)
    const trust = trustCookie(
      await post(
        "/api/auth/two-factor/verify-totp",
        { code: await totp(uri), trustDevice: true },
        cookiesFrom(await signIn(ana.email))
      )
    )
    const guest = await guestWithDraft()

    await signIn(ana.email, `${guest.cookie}; ${trust}`)

    expect(await draftOwner(guest.draft.id)).toBe(ana.userId)
  })

  it("moves nothing when the code is wrong", async () => {
    const ana = await signUp()
    await turnOn(ana)
    const guest = await guestWithDraft()
    const challenge = cookiesFrom(await signIn(ana.email, guest.cookie))

    await post(
      "/api/auth/two-factor/verify-totp",
      { code: "000000" },
      challenge
    )

    expect(await draftOwner(guest.draft.id)).toBe(guest.draft.userId)
  })
})

/** The trusted-device cookie a verify response set, as a Cookie header. */
function trustCookie(response: Response) {
  return cookiesFrom(response)
    .split("; ")
    .filter((cookie) => cookie.includes("trust_device="))
    .join("; ")
}

/**
 * The Cookie header a browser sends after `response`: its cookies replace
 * those with the same name, and an expired one is dropped.
 */
function jarAfter(cookie: string, response: Response) {
  const jar = new Map(
    cookie
      .split("; ")
      .filter(Boolean)
      .map((each) => [each.split("=")[0], each] as const)
  )
  for (const set of response.headers.getSetCookie()) {
    const [pair = ""] = set.split(";")
    const name = pair.split("=")[0]
    if (/max-age=0(;|$)/i.test(set)) jar.delete(name)
    else jar.set(name, pair)
  }
  return [...jar.values()].join("; ")
}

/** The Max-Age of a cookie the response set. */
function maxAge(response: Response, name: string) {
  const cookie = response.headers
    .getSetCookie()
    .find((each) => each.includes(`${name}=`))
  return Number(/max-age=(\d+)/i.exec(cookie ?? "")?.[1])
}
