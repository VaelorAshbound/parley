import { vi } from "vitest"

/**
 * Fakes Resend's HTTP API for one test and keeps what was "sent". Every
 * other request still goes out as usual. The Worker runs in this isolate, so
 * spying on fetch here catches its calls.
 */
export function fakeResend() {
  const sent: { to: string; subject: string; html: string; text: string }[] = []
  const realFetch = globalThis.fetch
  const spy = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input)
      if (!url.startsWith("https://api.resend.com/"))
        return realFetch(input, init)
      // The SDK sends a JSON string.
      sent.push(JSON.parse(init?.body as string))
      return Response.json({ id: `email-${sent.length}` })
    })
  return {
    sent,
    restore: () => spy.mockRestore(),
    /** The confirmation link in the last email to this address. */
    linkFor(to: string) {
      const email = sent.findLast((each) => each.to === to)
      const link = email?.text.match(/https?:\/\/\S+verify-email\?\S+/)?.[0]
      if (!link) throw new Error(`No confirmation link sent to ${to}`)
      return new URL(link)
    },
  }
}
