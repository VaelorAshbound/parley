// What an authenticator app does with the QR code Settings shows (T23b), for
// the tests: read the otpauth:// URI and make the code for a moment in time
// (RFC 6238 over RFC 4226, SHA-1). Written apart from Better Auth's own code,
// so the tests prove a real app can use the QR code. Web Crypto only: it
// runs in workerd (Worker tests) and in Node (Playwright).

const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

function base32Decode(text: string) {
  const bytes: number[] = []
  let bits = 0
  let value = 0
  for (const char of text.replace(/=+$/, "").toUpperCase()) {
    const index = base32Alphabet.indexOf(char)
    if (index < 0) throw new Error(`Not base32: ${char}`)
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      bits -= 8
      bytes.push((value >>> bits) & 0xff)
    }
  }
  return new Uint8Array(bytes)
}

/** The code an authenticator app shows for `uri` at `now` (ms). */
export async function totp(uri: string, now = Date.now()) {
  const params = new URL(uri).searchParams
  const secret = params.get("secret")
  if (!secret) throw new Error("The URI has no secret")
  const digits = Number(params.get("digits") ?? 6)
  const period = Number(params.get("period") ?? 30)

  const counter = new DataView(new ArrayBuffer(8))
  counter.setBigUint64(0, BigInt(Math.floor(now / 1000 / period)))
  const key = await crypto.subtle.importKey(
    "raw",
    base32Decode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  )
  const mac = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, counter.buffer)
  )
  const offset = (mac.at(-1) ?? 0) & 0x0f
  const binary =
    (((mac[offset] ?? 0) & 0x7f) << 24) |
    ((mac[offset + 1] ?? 0) << 16) |
    ((mac[offset + 2] ?? 0) << 8) |
    (mac[offset + 3] ?? 0)
  return String(binary % 10 ** digits).padStart(digits, "0")
}
