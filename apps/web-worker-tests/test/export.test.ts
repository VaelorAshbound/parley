import { ORPCError, safe } from "@orpc/client"
import type { RouterClient } from "@orpc/server"
import { connect, schema, setPlan } from "@workspace/db"
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

async function fill(client: Client, id: string, values: object) {
  await client.drafts.updateFields({
    id,
    changes: Object.entries(values).map(([key, value]) => ({ key, value })),
  })
}

/** A draft of a whole Mutual NDA, ready to export. */
async function completeNda(client: Client) {
  const draft = await client.drafts.create({ documentId: "mutual-nda", today })
  await fill(client, draft.id, filled)
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

/**
 * Waits until `n` sessions queue, directly or not, behind the lock that the
 * session `pid` holds. Only those: other test files share the database.
 */
async function waitForWaitersBehind(
  db: Awaited<ReturnType<typeof database>>,
  pid: number,
  n: number
) {
  for (let i = 0; i < 500; i++) {
    const { rows } = await db.$client.query(
      "select pid, pg_blocking_pids(pid) as blockers from pg_stat_activity where wait_event_type = 'Lock'"
    )
    const behind = new Set<number>([pid])
    for (let grew = true; grew;) {
      grew = false
      for (const row of rows as { pid: number; blockers: number[] }[])
        if (!behind.has(row.pid) && row.blockers.some((b) => behind.has(b))) {
          behind.add(row.pid)
          grew = true
        }
    }
    if (behind.size - 1 >= n) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`never saw ${n} sessions waiting behind ${pid}`)
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

  it("keeps the draft's own title in the name, accents and dash too", async () => {
    const { cookie } = await signUpVerified()
    const client = browserClient(cookie, fakeBrowserBinding().bindings)
    const id = await completeNda(client)
    const db = await database()
    await db
      .update(schema.draft)
      .set({ title: "Zoë's deal: Łódź/Berlin" })
      .where(eq(schema.draft.id, id))

    const file = await client.export.pdf({ id })

    // Through the real HTTP response and its Content-Disposition header.
    expect(file.name).toBe(
      "Zoë's deal Łódź Berlin – Mutual Non-Disclosure Agreement.pdf"
    )
  })

  it("downloads a long title that ends in an emoji, never cut in half", async () => {
    const { cookie } = await signUpVerified()
    const client = browserClient(cookie, fakeBrowserBinding().bindings)
    const id = await completeNda(client)
    const db = await database()
    await db
      .update(schema.draft)
      .set({ title: `${"a".repeat(79)}😀 deal` })
      .where(eq(schema.draft.id, id))

    const file = await client.export.pdf({ id })

    expect(file.name).toBe(
      `${"a".repeat(79)}😀 – Mutual Non-Disclosure Agreement.pdf`
    )
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
        documentId: "mutual-nda" as const,
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

  // Closing the tab mid-print is not a failure: it is logged as info, so it
  // never pages anyone.
  it("logs a download the user gave up as aborted, not as an error", async () => {
    const { cookie, email } = await signUpVerified()
    const leaving = new AbortController()
    const printPdf: PrintPdf = async () => {
      leaving.abort()
      throw new DOMException("The user left", "AbortError")
    }
    const { client } = await chatClient(cookie, scriptedModel([]), printPdf)
    const id = await completeNda(client)
    const errors = vi.spyOn(console, "error").mockImplementation(() => {})
    const infos = vi.spyOn(console, "log").mockImplementation(() => {})

    const { error } = await safe(
      client.export.pdf({ id }, { signal: leaving.signal })
    )

    expect(error).toBeTruthy()
    expect((await countedFor(email)).rows).toEqual([])
    expect(errors).not.toHaveBeenCalled()
    const line = infos.mock.calls
      .map(([entry]) => entry as Record<string, unknown>)
      .find((entry) => entry.event === "export")
    expect(line).toMatchObject({ level: "info", outcome: "aborted" })
    expect(line).not.toHaveProperty("status")
    expect(line).not.toHaveProperty("error")
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
    await fill(client, id, examples["pilot-agreement"])
    await client.export.pdf({ id })

    expect((await countedFor(email)).rows).toMatchObject([
      { draftId: id, documentId: "mutual-nda" },
      { draftId: id, documentId: "pilot-agreement" },
    ])
  })

  // PAR-51: the file is built from the draft read before the print; the
  // count is taken after it. A switch in between (the AI's chooseDocument
  // runs while Browser Run prints) must never hand over one agreement and
  // count another.
  it("refuses a download whose agreement was switched during the print", async () => {
    const { cookie, email } = await signUpVerified()
    const other = await serverClient(cookie)
    const printer = fakePrinter()
    let id = ""
    const printPdf: PrintPdf = async (html, frame) => {
      // Another request, its own connection, while the PDF is being made.
      await other.drafts.chooseDocument({
        id,
        documentId: "pilot-agreement",
        today,
      })
      return printer.printPdf(html, frame)
    }
    const { client } = await chatClient(cookie, scriptedModel([]), printPdf)
    id = await completeNda(client)

    const { error } = await safe(client.export.pdf({ id }))

    // The file printed was the Mutual NDA...
    expect(printer.pages[0]).toContain("Bolt Retail LLC")
    // ...so the Pilot Agreement the draft is on now must not be counted,
    expect((await countedFor(email)).rows).toEqual([])
    expect((await client.drafts.get({ id })).firstExportedAt).toBeNull()
    // and the user is told to download again, as the agreement it is now.
    expect(error).toMatchObject({ code: "DOCUMENT_CHANGED", defined: true })
  })

  // The switch commits inside the export's claim transaction, after the
  // print: between reading the draft and counting it. Something else holds
  // the draft's row (as any edit in flight does), the AI's chooseDocument
  // queues on it, then the export claims (PAR-51).
  it("refuses a download whose agreement was switched while it was being counted", async () => {
    const { cookie, email } = await signUpVerified()
    const other = await serverClient(cookie)
    const printer = fakePrinter()
    const holder = await database()
    const [{ pid }] = (
      await holder.$client.query("select pg_backend_pid() as pid")
    ).rows
    let id = ""
    let choose: Promise<unknown> | undefined
    const printPdf: PrintPdf = async (html, frame) => {
      await holder.$client.query("begin")
      await holder.$client.query(
        "select id from draft where id = $1 for update",
        [id]
      )
      choose = other.drafts.chooseDocument({
        id,
        documentId: "pilot-agreement",
        today,
      })
      await waitForWaitersBehind(holder, pid, 1)
      return printer.printPdf(html, frame)
    }
    const { client } = await chatClient(cookie, scriptedModel([]), printPdf)
    id = await completeNda(client)

    const exporting = safe(client.export.pdf({ id }))
    // The export now waits on the draft's row too.
    await waitForWaitersBehind(holder, pid, 2)
    await holder.$client.query("commit")
    const [{ error }] = await Promise.all([exporting, choose])

    expect(printer.pages[0]).toContain("Bolt Retail LLC")
    expect((await client.drafts.get({ id })).documentId).toBe("pilot-agreement")
    expect((await countedFor(email)).rows).toEqual([])
    expect(error).toMatchObject({ code: "DOCUMENT_CHANGED", defined: true })
  })

  it("never counts an agreement other than the one in a file, with two downloads at once", async () => {
    const { cookie, email } = await signUpVerified()
    const other = await serverClient(cookie)
    const printer = fakePrinter()
    let id = ""
    let prints = 0
    const printPdf: PrintPdf = async (html, frame) => {
      prints++
      if (prints === 1)
        await other.drafts.chooseDocument({
          id,
          documentId: "pilot-agreement",
          today,
        })
      return printer.printPdf(html, frame)
    }
    const first = (await chatClient(cookie, scriptedModel([]), printPdf)).client
    const second = (await chatClient(cookie, scriptedModel([]), printPdf))
      .client
    id = await completeNda(first)

    const results = await Promise.all([
      safe(first.export.pdf({ id })),
      safe(second.export.pdf({ id })),
    ])

    // Every page printed is the Mutual NDA; only it may ever be counted.
    for (const page of printer.pages) expect(page).toContain("Bolt Retail LLC")
    const counted = (await countedFor(email)).rows.map((row) => row.documentId)
    expect(counted).not.toContain("pilot-agreement")
    const files = results.flatMap(({ data }) => (data ? [data.name] : []))
    expect(
      files.filter((name) => name !== "Mutual Non-Disclosure Agreement.pdf")
    ).toEqual([])
  })

  // An edit, not a switch: the file would hold values the draft no longer
  // has, and an unfinished draft would be marked as downloaded.
  it("refuses a download whose draft was edited during the print", async () => {
    const { cookie, email } = await signUpVerified()
    const other = await serverClient(cookie)
    const printer = fakePrinter()
    let id = ""
    const printPdf: PrintPdf = async (html, frame) => {
      await other.drafts.updateFields({
        id,
        changes: [{ key: "purpose", value: null }],
      })
      return printer.printPdf(html, frame)
    }
    const { client } = await chatClient(cookie, scriptedModel([]), printPdf)
    id = await completeNda(client)

    const { error } = await safe(client.export.pdf({ id }))

    expect(printer.pages).toHaveLength(1)
    expect((await countedFor(email)).rows).toEqual([])
    expect((await client.drafts.get({ id })).firstExportedAt).toBeNull()
    expect(error).toMatchObject({ code: "DRAFT_CHANGED", defined: true })
  })

  it("refuses a download whose draft lost values to a switch away and back during the print", async () => {
    const { cookie, email } = await signUpVerified()
    const other = await serverClient(cookie)
    const printer = fakePrinter()
    let id = ""
    const printPdf: PrintPdf = async (html, frame) => {
      await other.drafts.chooseDocument({
        id,
        documentId: "pilot-agreement",
        today,
      })
      await other.drafts.chooseDocument({ id, documentId: "mutual-nda", today })
      return printer.printPdf(html, frame)
    }
    const { client } = await chatClient(cookie, scriptedModel([]), printPdf)
    id = await completeNda(client)

    const { error } = await safe(client.export.pdf({ id }))

    expect((await countedFor(email)).rows).toEqual([])
    expect((await client.drafts.get({ id })).firstExportedAt).toBeNull()
    expect(error).toMatchObject({ code: "DRAFT_CHANGED", defined: true })
  })

  it("still downloads when the draft only got a chat message during the print", async () => {
    const { cookie, email } = await signUpVerified()
    const printer = fakePrinter()
    let id = ""
    const db = await database()
    const printPdf: PrintPdf = async (html, frame) => {
      // A bump of updatedAt alone (as a chat turn does) is not an edit.
      await db
        .update(schema.draft)
        .set({ updatedAt: new Date() })
        .where(eq(schema.draft.id, id))
      return printer.printPdf(html, frame)
    }
    const { client } = await chatClient(cookie, scriptedModel([]), printPdf)
    id = await completeNda(client)

    const file = await client.export.pdf({ id })

    expect(file.name).toBe("Mutual Non-Disclosure Agreement.pdf")
    expect((await countedFor(email)).rows).toMatchObject([
      { documentId: "mutual-nda" },
    ])
  })

  it("keeps a counted agreement free after switching away and back", async () => {
    const { cookie, email } = await signUpVerified()
    const client = await serverClient(cookie)
    const id = await completeNda(client)
    await client.export.pdf({ id })
    const counted = (await client.drafts.get({ id })).firstExportedAt

    // A wrong pick in the agreement list, then back.
    await client.drafts.chooseDocument({
      id,
      documentId: "pilot-agreement",
      today,
    })
    await client.drafts.chooseDocument({ id, documentId: "mutual-nda", today })
    await fill(client, id, filled)
    await client.export.pdf({ id })

    expect((await client.drafts.get({ id })).firstExportedAt).toEqual(counted)
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

  // A sign-up and three Word files: past 5 s under coverage on a busy machine
  // (the production gate, 2026-10-01).
  it("is a Word file for Pro, and Pro has no monthly limit (T26)", async () => {
    const { cookie, email } = await signUpVerified()
    const { userId } = await countedFor(email)
    // As Polar's webhook does (billing.test.ts delivers the real one).
    await setPlan(await database(), { userId, plan: "pro", at: new Date() })
    const client = await serverClient(cookie)
    for (const _ of [1, 2, 3])
      await client.export.pdf({ id: await completeNda(client) })

    const pdf = await safe(client.export.pdf({ id: await completeNda(client) }))
    const docx = await safe(
      client.export.docx({ id: await completeNda(client) })
    )

    expect(pdf.error).toBeNull()
    expect(docx.error).toBeNull()
    expect(docx.data?.type).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
  }, 20_000)
})

describe("exportDraft when the user leaves", () => {
  it("counts nothing once the request was given up", async () => {
    const { cookie, email } = await signUpVerified()
    const client = await serverClient(cookie)
    const { userId } = await countedFor(email)
    const id = await completeNda(client)
    const leaving = new AbortController()
    // The tab closes while Browser Run prints.
    const printPdf: PrintPdf = async (html, frame) => {
      const printed = await fakePrinter().printPdf(html, frame)
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

    await expect(exporting).rejects.toMatchObject({ name: "AbortError" })
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
