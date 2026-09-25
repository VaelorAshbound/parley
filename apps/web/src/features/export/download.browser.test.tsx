import { ORPCError } from "@orpc/client"
import type { RouterClient } from "@orpc/server"
import { createTanstackQueryUtils } from "@orpc/tanstack-query"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"
import { render } from "vitest-browser-react"

import type { Router } from "@/server/rpc/router"

import { DownloadButton, DownloadMenu, DownloadProblem } from "./download"
import { useDownload } from "./use-download"

// Downloading from the document panel and the chat (T24). The server is a
// fake: each test says what export.pdf and export.docx answer.

const draftId = "0199c0de-0000-7000-8000-000000000024"

type Answer = () => Promise<File>

function fakeServer({ pdf, docx }: { pdf?: Answer; docx?: Answer }) {
  const never: Answer = () => Promise.reject(new Error("not asked"))
  const client = {
    export: { pdf: pdf ?? never, docx: docx ?? never },
  } as unknown as RouterClient<Router>
  return createTanstackQueryUtils(client)
}

const pdfFile = () =>
  new File(["%PDF-1.7"], "Bolt – Mutual Non-Disclosure Agreement.pdf", {
    type: "application/pdf",
  })

/** The files the page handed to the browser to save, by name. */
function savedFiles() {
  const names: string[] = []
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    names.push(this.download)
  })
  return names
}

function Panel({
  orpc,
  id = draftId,
}: {
  orpc: ReturnType<typeof fakeServer>
  id?: string
}) {
  const download = useDownload(orpc, id)
  return (
    <>
      <DownloadMenu download={download} />
      <DownloadProblem download={download} />
    </>
  )
}

const queryClient = () => new QueryClient()

function renderWith(node: ReactNode, client = queryClient()) {
  return render(
    <QueryClientProvider client={client}>{node}</QueryClientProvider>
  )
}

afterEach(() => vi.restoreAllMocks())

describe("the Download menu", () => {
  test("saves the PDF under the name the server gave it", async () => {
    const saved = savedFiles()
    const screen = await renderWith(
      <Panel orpc={fakeServer({ pdf: async () => pdfFile() })} />
    )

    await screen.getByRole("button", { name: "Download" }).click()
    await screen.getByRole("menuitem", { name: "PDF" }).click()

    await expect
      .poll(() => saved)
      .toEqual(["Bolt – Mutual Non-Disclosure Agreement.pdf"])
  })

  test("can't start a second download while the file is being made", async () => {
    let finish: (file: File) => void = () => {}
    const screen = await renderWith(
      <Panel
        orpc={fakeServer({
          pdf: () => new Promise((resolve) => (finish = resolve)),
        })}
      />
    )
    savedFiles()

    await screen.getByRole("button", { name: "Download" }).click()
    await screen.getByRole("menuitem", { name: "PDF" }).click()

    const button = screen.getByRole("button", { name: /Download/ })
    await expect.element(button).toBeDisabled()
    await expect
      .element(screen.getByRole("status", { name: "Making your file" }))
      .toBeInTheDocument()
    finish(pdfFile())
    await expect.element(button).toBeEnabled()
  })

  test("offers Pro for a Word file, and says a PDF still works", async () => {
    const screen = await renderWith(
      <Panel
        orpc={fakeServer({
          docx: () =>
            Promise.reject(new ORPCError("PRO_REQUIRED", { defined: true })),
        })}
      />
    )

    await screen.getByRole("button", { name: "Download" }).click()
    await screen.getByRole("menuitem", { name: /Word/ }).click()

    await expect
      .element(screen.getByRole("alert"))
      .toMatchTextContent(
        /Word files come with Pro\. You can still download a PDF\./
      )
    await expect
      .element(screen.getByRole("link", { name: "Upgrade to Pro" }))
      .toHaveAttribute("href", "/pricing")
  })

  test("asks a guest to make an account, and comes back to the draft", async () => {
    const screen = await renderWith(
      <Panel
        orpc={fakeServer({
          pdf: () =>
            Promise.reject(new ORPCError("UNAUTHORIZED", { defined: true })),
        })}
      />
    )

    await screen.getByRole("button", { name: "Download" }).click()
    await screen.getByRole("menuitem", { name: "PDF" }).click()

    await expect
      .element(screen.getByRole("link", { name: "Create an account" }))
      .toHaveAttribute(
        "href",
        `/sign-up?redirect=${encodeURIComponent(`/d/${draftId}`)}`
      )
  })

  test("the message can be closed", async () => {
    const screen = await renderWith(
      <Panel
        orpc={fakeServer({
          pdf: () =>
            Promise.reject(
              new ORPCError("QUOTA_EXCEEDED", {
                defined: true,
                data: { limit: 3 },
              })
            ),
        })}
      />
    )
    await screen.getByRole("button", { name: "Download" }).click()
    await screen.getByRole("menuitem", { name: "PDF" }).click()
    await expect.element(screen.getByRole("alert")).toBeVisible()

    await screen.getByRole("button", { name: "Close message" }).click()

    await expect.element(screen.getByRole("alert")).not.toBeInTheDocument()
  })

  test("doesn't carry a message over to the next draft", async () => {
    // The draft page stays mounted when another draft opens.
    const orpc = fakeServer({
      pdf: () =>
        Promise.reject(new ORPCError("NO_DOCUMENT", { defined: true })),
    })
    const client = queryClient()
    const screen = await renderWith(<Panel orpc={orpc} />, client)
    await screen.getByRole("button", { name: "Download" }).click()
    await screen.getByRole("menuitem", { name: "PDF" }).click()
    await expect.element(screen.getByRole("alert")).toBeVisible()

    await screen.rerender(
      <QueryClientProvider client={client}>
        <Panel orpc={orpc} id="0199c0de-0000-7000-8000-000000000025" />
      </QueryClientProvider>
    )

    await expect.element(screen.getByRole("alert")).not.toBeInTheDocument()
  })
})

describe("the draft's download controls together", () => {
  test("while the chat's button makes the PDF, the panel's menu waits too", async () => {
    let finish: (file: File) => void = () => {}
    const orpc = fakeServer({
      pdf: () => new Promise((resolve) => (finish = resolve)),
    })
    const screen = await renderWith(
      <>
        <Panel orpc={orpc} />
        <DownloadButton orpc={orpc} draftId={draftId} />
      </>
    )
    savedFiles()

    await screen.getByRole("button", { name: "Download PDF" }).click()

    // One Browser Run print at a time for a draft, whichever control starts it.
    const menu = screen.getByRole("button", { name: /Download$/ })
    await expect.element(menu).toBeDisabled()
    finish(pdfFile())
    await expect.element(menu).toBeEnabled()
  })

  test("another draft's download doesn't hold this one up", async () => {
    const orpc = fakeServer({ pdf: () => new Promise(() => {}) })
    const screen = await renderWith(
      <>
        <Panel orpc={orpc} />
        <DownloadButton
          orpc={orpc}
          draftId="0199c0de-0000-7000-8000-000000000025"
        />
      </>
    )

    await screen.getByRole("button", { name: "Download PDF" }).click()

    await expect
      .element(screen.getByRole("button", { name: /Download PDF$/ }))
      .toBeDisabled()
    await expect
      .element(screen.getByRole("button", { name: /Download$/ }))
      .toBeEnabled()
  })
})

describe("the chat's Download PDF button", () => {
  test("saves the PDF", async () => {
    const saved = savedFiles()
    const screen = await renderWith(
      <DownloadButton
        orpc={fakeServer({ pdf: async () => pdfFile() })}
        draftId={draftId}
      />
    )

    await screen.getByRole("button", { name: "Download PDF" }).click()

    await expect.poll(() => saved).toHaveLength(1)
  })

  test("shows why it couldn't, right under it", async () => {
    const screen = await renderWith(
      <DownloadButton
        orpc={fakeServer({
          pdf: () =>
            Promise.reject(
              new ORPCError("EMAIL_NOT_VERIFIED", { defined: true })
            ),
        })}
        draftId={draftId}
      />
    )

    await screen.getByRole("button", { name: "Download PDF" }).click()

    await expect
      .element(screen.getByRole("alert"))
      .toMatchTextContent(/Confirm your email to download\./)
  })
})
