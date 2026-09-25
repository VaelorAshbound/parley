import { ORPCError, safe } from "@orpc/client"
import type { RouterClient } from "@orpc/server"
import { connect, schema } from "@workspace/db"
import { definitions } from "@workspace/documents"
import { env } from "cloudflare:workers"
import { eq } from "drizzle-orm"
import { Temporal } from "temporal-polyfill"
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest"

import { examples } from "../../../packages/documents/test/examples"
import type { PrintPdf } from "../../web/src/server/files"
import { exportDraft } from "../../web/src/server/rpc/export"
import type { Router } from "../../web/src/server/rpc/router"
import {
  browserClient,
  chatClient,
  FAKE_PDF,
  fakeBrowserBinding,
  fakePrinter,
  scriptedModel,
  serverClient,
  signUpVerified,
} from "./helpers"

// Export and its quota (spec §2 Quota, T24) through the real procedures and
// a real Postgres. Browser Run is faked here; `pnpm test:workers:real`
// prints for real (export.real.test.ts).

const today = "2026-09-25"
const filled = examples["mutual-nda"]

type Client = RouterClient<Router>

/** A draft of a whole Mutual NDA, ready to export. */
async function completeNda(client: Client) {
  const draft = await client.drafts.create({ documentId: "mutual-nda", today })
  await client.drafts.updateFields({
    id: draft.id,
    changes: Object.entries(filled).map(([key, value]) => ({ key, value })),
  })
  return draft.id
}

async function database() {
  const db = await connect(env.HYPERDRIVE.connectionString)
  onTestFinished(() => db.$client.end())
  return db
}

async function countedFor(email: string) {
  const db = await database()
  const [user] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, email))
  if (!user) throw new Error("no such user")
  const rows = await db
    .select()
    .from(schema.countedExport)
    .where(eq(schema.countedExport.userId, user.id))
  return { userId: user.id, rows }
}

function codeOf(error: unknown) {
  return error instanceof ORPCError ? error.code : error
}

afterEach(() => vi.restoreAllMocks())

describe("export.pdf", () => {
  it("downloads a finished draft as a PDF named after it", async () => {
    const { cookie } = await signUpVerified()
    const browser = fakeBrowserBinding()
    const client = browserClient(cookie, browser.bindings)
    const id = await completeNda(client)

    const file = await client.export.pdf({ id })

    expect(file).toBeInstanceOf(File)
    expect(file.name).toBe("Mutual Non-Disclosure Agreement.pdf")
    expect(file.type).toBe("application/pdf")
    expect(await file.text()).toBe(FAKE_PDF)
    // The engine's print page, with the draft's values and the brand fonts.
    expect(browser.pages).toHaveLength(1)
    expect(browser.pages[0]).toContain("Bolt Retail LLC")
    expect(browser.pages[0]).toContain("data:font/woff2;base64,")
  })

  it("counts the first download of a document", async () => {
    const { cookie, email } = await signUpVerified()
    const client = await serverClient(cookie)
    const id = await completeNda(client)

    await client.export.pdf({ id })

    const { rows } = await countedFor(email)
    expect(rows).toMatchObject([{ draftId: id }])
    expect((await client.drafts.get({ id })).firstExportedAt).toBeInstanceOf(
      Date
    )
  })

  it("lets a counted document download again for free", async () => {
    const { cookie, email } = await signUpVerified()
    const client = await serverClient(cookie)
    const id = await completeNda(client)

    await client.export.pdf({ id })
    await client.export.pdf({ id })

    expect((await countedFor(email)).rows).toHaveLength(1)
  })

  it("allows 3 documents a month, then asks to upgrade", async () => {
    const { cookie, email } = await signUpVerified()
    const printer = fakePrinter()
    const { client } = await chatClient(
      cookie,
      scriptedModel([]),
      printer.printPdf
    )
    for (const _ of [1, 2, 3])
      await client.export.pdf({ id: await completeNda(client) })
    const fourth = await completeNda(client)

    const { error } = await safe(client.export.pdf({ id: fourth }))

    expect(error).toMatchObject({
      code: "QUOTA_EXCEEDED",
      defined: true,
      data: { limit: 3 },
    })
    // Refused before Browser Run was asked, and nothing more was counted.
    expect(printer.pages).toHaveLength(3)
    expect((await countedFor(email)).rows).toHaveLength(3)
  })

  it("still lets the month's counted documents download after the limit", async () => {
    const { cookie } = await signUpVerified()
    const client = await serverClient(cookie)
    const ids = [
      await completeNda(client),
      await completeNda(client),
      await completeNda(client),
    ]
    for (const id of ids) await client.export.pdf({ id })

    const { error } = await safe(client.export.pdf({ id: ids[0] ?? "" }))

    expect(error).toBeNull()
  })

  it("doesn't count last month's documents", async () => {
    const { cookie, email } = await signUpVerified()
    const client = await serverClient(cookie)
    const { userId } = await countedFor(email)
    const db = await database()
    const lastMonth = Temporal.Now.instant()
      .toZonedDateTimeISO("UTC")
      .with({ day: 1 })
      .subtract({ days: 1 })
    await db.insert(schema.countedExport).values(
      [1, 2, 3].map(() => ({
        userId,
        draftId: crypto.randomUUID(),
        countedAt: new Date(lastMonth.epochMilliseconds),
      }))
    )

    const { error } = await safe(
      client.export.pdf({ id: await completeNda(client) })
    )

    expect(error).toBeNull()
  })

  it("keeps counting a downloaded draft after it is deleted", async () => {
    const { cookie, email } = await signUpVerified()
    const client = await serverClient(cookie)
    const ids = [
      await completeNda(client),
      await completeNda(client),
      await completeNda(client),
    ]
    for (const id of ids) await client.export.pdf({ id })
    const db = await database()
    await db.delete(schema.draft).where(eq(schema.draft.id, ids[0] ?? ""))

    const { error } = await safe(
      client.export.pdf({ id: await completeNda(client) })
    )

    expect(codeOf(error)).toBe("QUOTA_EXCEEDED")
    expect((await countedFor(email)).rows).toHaveLength(3)
  })

  it("never lets two downloads at once both take the last free document", async () => {
    const { cookie, email } = await signUpVerified()
    const client = await serverClient(cookie)
    for (const _ of [1, 2])
      await client.export.pdf({ id: await completeNda(client) })
    const [a, b] = [await completeNda(client), await completeNda(client)]
    // Two requests, each with its own database connection, as in production.
    const [first, second] = [
      browserClient(cookie, fakeBrowserBinding().bindings),
      browserClient(cookie, fakeBrowserBinding().bindings),
    ]

    const results = await Promise.all([
      safe(first.export.pdf({ id: a })),
      safe(second.export.pdf({ id: b })),
    ])

    // Either may win; exactly one does.
    const codes = results.map(({ error }) => codeOf(error))
    expect(codes).toContain(null)
    expect(codes).toContain("QUOTA_EXCEEDED")
    expect((await countedFor(email)).rows).toHaveLength(3)
  })

  it("names what is missing in an unfinished draft, and prints nothing", async () => {
    const { cookie, email } = await signUpVerified()
    const printer = fakePrinter()
    const { client } = await chatClient(
      cookie,
      scriptedModel([]),
      printer.printPdf
    )
    const draft = await client.drafts.create({
      documentId: "mutual-nda",
      today,
    })

    const { error } = await safe(client.export.pdf({ id: draft.id }))

    expect(error).toMatchObject({ code: "INCOMPLETE", defined: true })
    const missing = (
      error as ORPCError<
        "INCOMPLETE",
        { missing: { key: string; label: string }[] }
      >
    ).data.missing
    expect(missing).toContainEqual({
      key: "governingLaw",
      label: definitions["mutual-nda"].fields.governingLaw.label,
    })
    // One entry per field, even when several of its parts are missing.
    expect(new Set(missing.map(({ key }) => key)).size).toBe(missing.length)
    expect(printer.pages).toEqual([])
    expect((await countedFor(email)).rows).toEqual([])
  })

  it("asks for an agreement first when the draft has none", async () => {
    const { cookie } = await signUpVerified()
    const client = await serverClient(cookie)
    const draft = await client.drafts.create({ today })

    const { error } = await safe(client.export.pdf({ id: draft.id }))

    expect(error).toMatchObject({ code: "NO_DOCUMENT", defined: true })
  })

  it("counts nothing when Browser Run can't print", async () => {
    const { cookie, email } = await signUpVerified()
    const browser = fakeBrowserBinding(429)
    const client = browserClient(cookie, browser.bindings)
    const id = await completeNda(client)
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})

    const { error } = await safe(client.export.pdf({ id }))

    expect(error).toMatchObject({ code: "EXPORT_FAILED", defined: true })
    expect((await countedFor(email)).rows).toEqual([])
    expect((await client.drafts.get({ id })).firstExportedAt).toBeNull()
    expect(logged).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "error",
        event: "export",
        outcome: "failed",
        format: "pdf",
        status: 429,
        error: { name: "PrintFailed" },
      })
    )
  })

  it("logs each download without the draft's words", async () => {
    const { cookie } = await signUpVerified()
    const client = await serverClient(cookie)
    const id = await completeNda(client)
    await client.drafts.updateFields({
      id,
      changes: [{ key: "purpose", value: "A secret purpose." }],
    })
    const logged = vi.spyOn(console, "log").mockImplementation(() => {})

    await client.export.pdf({ id })

    const line = logged.mock.calls
      .map(([entry]) => entry as Record<string, unknown>)
      .find((entry) => entry.event === "export")
    expect(line).toMatchObject({
      level: "info",
      event: "export",
      draftId: id,
      format: "pdf",
      outcome: "done",
      counted: true,
      browserMs: 180,
      bytes: FAKE_PDF.length,
    })
    expect(JSON.stringify(line)).not.toMatch(/secret|Bolt/i)
  })

  it("makes a switched agreement a new document, counted again", async () => {
    const { cookie, email } = await signUpVerified()
    const client = await serverClient(cookie)
    const id = await completeNda(client)
    await client.export.pdf({ id })

    await client.drafts.chooseDocument({
      id,
      documentId: "pilot-agreement",
      today,
    })

    expect((await client.drafts.get({ id })).firstExportedAt).toBeNull()
    expect((await countedFor(email)).rows).toHaveLength(1)
  })
})

describe("export.docx", () => {
  it("is for Pro: a free account is asked to upgrade, and nothing is counted", async () => {
    const { cookie, email } = await signUpVerified()
    const client = await serverClient(cookie)
    const id = await completeNda(client)

    const { error } = await safe(client.export.docx({ id }))

    expect(error).toMatchObject({ code: "PRO_REQUIRED", defined: true })
    expect((await countedFor(email)).rows).toEqual([])
  })
})

describe("exportDraft when the user leaves", () => {
  it("counts nothing once the request was given up", async () => {
    const { cookie, email } = await signUpVerified()
    const client = await serverClient(cookie)
    const { userId } = await countedFor(email)
    const id = await completeNda(client)
    const leaving = new AbortController()
    // The tab closes while Browser Run prints.
    const printPdf: PrintPdf = async (html) => {
      const printed = await fakePrinter().printPdf(html)
      leaving.abort()
      return printed
    }

    const exporting = exportDraft({
      db: await database(),
      printPdf,
      userId,
      draft: await client.drafts.get({ id }),
      format: "pdf",
      plan: "free",
      now: Temporal.Now.instant(),
      signal: leaving.signal,
    })

    await expect(exporting).rejects.toThrow()
    expect((await countedFor(email)).rows).toEqual([])
  })
})

describe("exportDraft on the Pro plan", () => {
  async function proExport(format: "pdf" | "docx", times: number) {
    const { cookie, email } = await signUpVerified()
    const client = await serverClient(cookie)
    const db = await database()
    const { userId } = await countedFor(email)
    const outcomes = []
    for (let each = 0; each < times; each++) {
      const id = await completeNda(client)
      const draft = await client.drafts.get({ id })
      outcomes.push(
        await exportDraft({
          db,
          printPdf: fakePrinter().printPdf,
          userId,
          draft,
          format,
          plan: "pro",
          now: Temporal.Now.instant(),
        })
      )
    }
    return { outcomes, email }
  }

  // The first Word file loads the `docx` library (a lazy import), which the
  // test runner transforms on first use: over 5 s on a busy machine.
  it(
    "downloads a Word file that opens as a Word package",
    {
      timeout: 30_000,
    },
    async () => {
      const { outcomes } = await proExport("docx", 1)

      const [outcome] = outcomes
      if (!outcome?.ok) throw new Error("expected a file")
      expect(outcome.file.name).toBe("Mutual Non-Disclosure Agreement.docx")
      const JSZip = (await import("jszip")).default
      const zip = await JSZip.loadAsync(await outcome.file.arrayBuffer())
      expect(await zip.file("word/document.xml")?.async("string")).toContain(
        "Bolt Retail LLC"
      )
    }
  )

  it("has no monthly limit, and still counts each document", async () => {
    const { outcomes, email } = await proExport("pdf", 4)

    expect(outcomes.map(({ ok }) => ok)).toEqual([true, true, true, true])
    expect((await countedFor(email)).rows).toHaveLength(4)
  })
})
