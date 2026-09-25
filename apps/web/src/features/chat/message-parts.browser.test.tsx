import { definitions } from "@workspace/documents"
import type { ReactNode } from "react"
import { expect, test, vi } from "vite-plus/test"
import { render } from "vitest-browser-react"

import { UiStoreProvider } from "@/lib/ui-store"
import type { ChatMessage } from "@/server/ai/chat"

import { MessageParts } from "./message-parts"

const nda = definitions["mutual-nda"]

/** Rows read their Undo state from the UI store. */
const renderWithStore = (node: ReactNode) =>
  render(<UiStoreProvider>{node}</UiStoreProvider>)

function changed(key: string, after: unknown): ChatMessage["parts"][number] {
  return {
    type: "tool-updateFields",
    toolCallId: `call-${key}`,
    state: "output-available",
    input: { changes: [{ key, value: after, explanation: "Set." }] },
    output: {
      applied: [{ key, after, explanation: "Set." }],
      rejected: [],
      inverse: [{ key, value: null, expected: after }],
    },
  }
}

test("names a change by its field and shows the value in the document's words", async () => {
  const screen = await renderWithStore(
    <MessageParts
      parts={[changed("mndaTerm", { option: "untilTerminated" })]}
      definition={nda}
    />
  )

  const row = screen.getByRole("listitem")
  await expect.element(row).toBeVisible()
  expect(row.element().textContent).toBe(
    "MNDA term→set toContinues until terminated in accordance with the terms of the MNDA."
  )
})

test("shows the parts of a party that changed, not just its company", async () => {
  const part = changed("party1", {
    company: "Acme",
    name: "Ana Diaz",
    title: "CEO",
  })
  if (part.type === "tool-updateFields" && part.state === "output-available")
    part.output.applied[0] = {
      key: "party1",
      before: { company: "Acme" },
      after: { company: "Acme", name: "Ana Diaz", title: "CEO" },
      explanation: "Set.",
    }
  const screen = await renderWithStore(
    <MessageParts parts={[part]} definition={nda} />
  )

  await expect.element(screen.getByText("Ana Diaz, CEO")).toBeVisible()
})

test("keeps bold words and paragraphs, and never renders HTML", async () => {
  const screen = await renderWithStore(
    <MessageParts
      parts={[
        {
          type: "text",
          text: "A **Mutual NDA** fits.\n\n<img src=x onerror=alert(1)> is text.",
        },
      ]}
      definition={nda}
    />
  )

  await expect
    .element(screen.getByText("Mutual NDA"))
    .toHaveProperty("tagName", "STRONG")
  await expect
    .element(screen.getByText("<img src=x onerror=alert(1)> is text."))
    .toBeVisible()
  expect(document.querySelector("img")).toBeNull()
})

test("shows a choice's blank, not the whole sentence around it", async () => {
  const screen = await renderWithStore(
    <MessageParts
      parts={[
        changed("mndaTerm", {
          option: "expires",
          value: { amount: 2, unit: "years" },
        }),
      ]}
      definition={nda}
    />
  )

  await expect
    .element(screen.getByText("2 years", { exact: true }))
    .toBeVisible()
})

test("undoes a change with its inverse, then says it's undone", async () => {
  const onUndo = vi.fn<(undo: unknown) => void>()
  const screen = await renderWithStore(
    <MessageParts
      parts={[changed("purpose", "Hiring.")]}
      definition={nda}
      onUndo={onUndo}
    />
  )

  await screen.getByRole("button", { name: "Undo Purpose" }).click()

  expect(onUndo).toHaveBeenCalledWith({
    row: "call-purpose:purpose",
    change: { key: "purpose", value: null, expected: "Hiring." },
  })
})

test("shows no Undo without an undo handler", async () => {
  const screen = await renderWithStore(
    <MessageParts parts={[changed("purpose", "Hiring.")]} definition={nda} />
  )

  await expect
    .element(screen.getByRole("button", { name: /Undo/ }))
    .not.toBeInTheDocument()
})

test("names a state in a jurisdiction change, not its code", async () => {
  const screen = await renderWithStore(
    <MessageParts
      parts={[
        changed("governingLaw", { state: "DE", courtLocation: "New Castle" }),
      ]}
      definition={nda}
    />
  )

  await expect
    .element(screen.getByText("Delaware, New Castle", { exact: true }))
    .toBeVisible()
})
