import { describe, expect, it, vi } from "vitest"

import { browserClient, call, cookiesFrom } from "./helpers"

// T29: the request line through the real /api app in workerd, and what it
// must never hold (spec §9: logs hold IDs and counts only).

const today = "2026-09-25"

/** Everything written to the console while `run` runs, and its result. */
async function captured<T>(run: () => Promise<T>) {
  using info = vi.spyOn(console, "log").mockImplementation(() => {})
  using warn = vi.spyOn(console, "warn").mockImplementation(() => {})
  using error = vi.spyOn(console, "error").mockImplementation(() => {})
  const result = await run()
  const lines = [info, warn, error].flatMap((spy) =>
    spy.mock.calls.map(([line]) => line as Record<string, unknown>)
  )
  return { result, lines, text: JSON.stringify(lines) }
}

describe("the request line", () => {
  it("names a guest's sign-in by its route pattern, without the new session's token", async () => {
    const {
      result: response,
      lines,
      text,
    } = await captured(() =>
      call("/api/auth/sign-in/anonymous", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      })
    )

    expect(lines).toEqual([
      {
        level: "info",
        event: "request",
        requestId: expect.any(String),
        method: "POST",
        route: "/api/auth/*",
        status: 200,
        latencyMs: expect.any(Number),
      },
    ])
    const token = cookiesFrom(response).split("=")[1] ?? ""
    expect(token.length).toBeGreaterThan(10)
    expect(text).not.toContain(token)
  })

  it("names the procedure and the user's tier, and none of the values sent", async () => {
    const signIn = await call("/api/auth/sign-in/anonymous", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    })
    const { user } = await signIn.json<{ user: { id: string } }>()
    const client = browserClient(cookiesFrom(signIn))
    const draft = await client.drafts.create({
      documentId: "mutual-nda",
      today,
    })

    const { lines, text } = await captured(() =>
      client.drafts.updateFields({
        id: draft.id,
        changes: [{ key: "purpose", value: "Merging with Zebracorp quietly." }],
      })
    )

    expect(lines).toEqual([
      expect.objectContaining({
        event: "request",
        route: "/api/rpc/drafts/updateFields",
        status: 200,
        tier: "guest",
        userId: user.id,
      }),
    ])
    expect(text).not.toContain("Zebracorp")
  })

  it("keeps the route pattern when a procedure refuses the caller", async () => {
    const { lines } = await captured(() =>
      call("/api/rpc/drafts/list", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": "orpc" },
        body: JSON.stringify({ json: {} }),
      })
    )

    expect(lines).toEqual([
      expect.objectContaining({
        event: "request",
        route: "/api/rpc/drafts/list",
        status: 401,
      }),
    ])
    expect(lines[0]).not.toHaveProperty("tier")
  })
})
