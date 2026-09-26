// Cloudflare Turnstile's siteverify, faked for every Worker test, so the
// tests run offline and never depend on Cloudflare. It answers like the real
// endpoint (https://developers.cloudflare.com/turnstile/get-started/server-side-validation/):
// - Cloudflare's dummy token passes, as with the test secret key
//   (hostname "localhost", action "test");
// - `pass:<hostname>:<action>` passes with that hostname and action, to test
//   the production checks;
// - anything else fails with invalid-input-response.

export const passingToken = "XXXX.DUMMY.TOKEN.XXXX"

const siteverify = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
const realFetch = globalThis.fetch

globalThis.fetch = async (input, init) => {
  const url = input instanceof Request ? input.url : String(input)
  if (url !== siteverify) return realFetch(input, init)
  // Better Auth sends a JSON string.
  const { response } = JSON.parse(init?.body as string) as { response: string }
  const [kind, hostname, action] = response.split(":")
  if (response === passingToken)
    return Response.json({
      success: true,
      hostname: "localhost",
      action: "test",
      "error-codes": [],
    })
  if (kind === "pass")
    return Response.json({ success: true, hostname, action, "error-codes": [] })
  return Response.json({
    success: false,
    "error-codes": ["invalid-input-response"],
  })
}
