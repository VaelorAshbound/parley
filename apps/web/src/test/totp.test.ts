import { describe, expect, it } from "vite-plus/test"

import { totp } from "./totp"

// RFC 6238, appendix B: SHA-1, the ASCII secret "12345678901234567890", and
// 8 digits. An authenticator app reads the secret from the QR code in
// base32, so that is what the helper takes.
const rfcSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"

describe("totp", () => {
  it.each([
    [59, "94287082"],
    [1_111_111_109, "07081804"],
    [1_234_567_890, "89005924"],
    [20_000_000_000, "65353130"],
  ])("matches RFC 6238 at %i s", async (seconds, code) => {
    const uri = `otpauth://totp/Parley:a?secret=${rfcSecret}&digits=8&period=30`

    expect(await totp(uri, seconds * 1000)).toBe(code)
  })

  it("uses 6 digits and 30 s when the URI doesn't say", async () => {
    const uri = `otpauth://totp/Parley:a?secret=${rfcSecret}`

    expect(await totp(uri, 59_000)).toBe("287082")
  })
})
