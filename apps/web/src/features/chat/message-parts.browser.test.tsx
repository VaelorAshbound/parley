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

test("clamps a long value to two lines, and gives the whole of it on hover and in the row's name", async () => {
  // T36: at 375 px the row read "Purpose → Sharing our pro...", and its
  // accessible name was the field's hint. The owner chose a 2-line clamp,
  // with the full value on hover and in the name (PAR-42).
  const purpose =
    "Sharing our product roadmap to evaluate a possible distribution partnership in Europe, and the pricing that goes with it."
  const screen = await renderWithStore(
    <div style={{ width: 320 }}>
      <MessageParts
        parts={[changed("purpose", purpose)]}
        definition={nda}
        onUndo={() => {}}
      />
    </div>
  )

  const row = screen.getByRole("listitem", {
    name: `Purpose set to ${purpose}`,
  })
  await expect.element(row).toBeVisible()
  const value = screen.getByText(purpose).element()
  expect(value.getAttribute("title")).toBe(purpose)
  const line = parseFloat(getComputedStyle(value).lineHeight)
  expect(value.clientHeight).toBeLessThanOrEqual(2 * line + 1)
  expect(value.scrollHeight).toBeGreaterThan(value.clientHeight)
  expect(value.scrollWidth).toBeLessThanOrEqual(value.clientWidth)
  expect(value.getBoundingClientRect().right).toBeLessThanOrEqual(
    row.element().getBoundingClientRect().right
  )
})

test("lines the icon, the field and Undo up with the value's first line", async () => {
  // PAR-42: centered on a two-line value, they floated between its lines.
  const purpose =
    "Sharing our product roadmap to evaluate a possible distribution partnership in Europe."
  const screen = await renderWithStore(
    <div style={{ width: 320 }}>
      <MessageParts
        parts={[changed("purpose", purpose)]}
        definition={nda}
        onUndo={() => {}}
      />
    </div>
  )

  const value = screen.getByText(purpose).element()
  await expect.element(value).toBeVisible()
  const box = value.getBoundingClientRect()
  const line = parseFloat(getComputedStyle(value).lineHeight)
  expect(box.height).toBeGreaterThan(line * 1.5)
  const firstLine = box.top + line / 2
  const middle = (element: Element) => {
    const { top, height } = element.getBoundingClientRect()
    return top + height / 2
  }
  const row = screen.getByRole("listitem").element()
  const icon = row.querySelector("[data-slot=marker-icon]")
  expect(icon).not.toBeNull()
  expect(Math.abs(middle(icon!) - firstLine)).toBeLessThanOrEqual(1.5)
  const field = screen.getByText("Purpose", { exact: true }).element()
  expect(Math.abs(middle(field) - firstLine)).toBeLessThanOrEqual(1.5)
  const undo = screen.getByRole("button", { name: "Undo Purpose" }).element()
  expect(Math.abs(middle(undo) - firstLine)).toBeLessThanOrEqual(1.5)
})

test("keeps a one-line change row as tall as before", async () => {
  const screen = await renderWithStore(
    <MessageParts
      parts={[changed("purpose", "Hiring.")]}
      definition={nda}
      onUndo={() => {}}
    />
  )

  const row = screen.getByRole("listitem")
  await expect.element(row).toBeVisible()
  expect(row.element().getBoundingClientRect().height).toBeCloseTo(42, 0)
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

const keyTerms = {
  title: "Key terms",
  questions: [
    {
      name: "term",
      prompt: "How long should the NDA last?",
      required: true,
      choices: [{ value: "2y", label: "2 years" }],
      multiple: false,
    },
    {
      name: "law",
      prompt: "Which state's law applies?",
      required: false,
      choices: [],
      multiple: false,
    },
  ],
}

test("folds answered questions into one line, in the user's words", async () => {
  const screen = await renderWithStore(
    <MessageParts
      parts={[
        {
          type: "tool-askQuestions",
          toolCallId: "call-q",
          state: "output-available",
          input: keyTerms,
          output: { answers: { term: ["2y"], law: ["Texas"] } },
        },
      ]}
      definition={nda}
    />
  )

  await expect
    .element(screen.getByText("Key terms answered ·", { exact: false }))
    .toHaveTextContent("Key terms answered · 2 years, Texas")
})

test("marks questions that were answered in the chat instead", async () => {
  const screen = await renderWithStore(
    <MessageParts
      parts={[
        {
          type: "tool-askQuestions",
          toolCallId: "call-q",
          state: "output-error",
          input: keyTerms,
          errorText: "The user replied in the chat instead.",
        },
      ]}
      definition={nda}
    />
  )

  await expect
    .element(screen.getByText("Key terms · answered in the chat"))
    .toBeVisible()
})

test("says the agreement is complete once nothing is missing", async () => {
  const screen = await renderWithStore(
    <MessageParts
      parts={[
        {
          type: "tool-markComplete",
          toolCallId: "call-done",
          state: "output-available",
          input: {},
          output: { complete: true, missing: [] },
        },
      ]}
      definition={nda}
      download={<button type="button">Download PDF</button>}
    />
  )

  await expect
    .element(
      screen.getByText("Your Mutual Non-Disclosure Agreement is complete")
    )
    .toBeVisible()
  // The way to the file comes with the news.
  await expect
    .element(screen.getByRole("button", { name: "Download PDF" }))
    .toBeVisible()
})

test("shows why the AI picked the agreement, under the pick", async () => {
  const screen = await renderWithStore(
    <MessageParts
      parts={[
        {
          type: "tool-chooseDocument",
          toolCallId: "call-pick",
          state: "output-available",
          input: {
            documentId: "csa",
            reason: "A CSA usually comes with an SLA and a DPA.",
          },
          output: { documentId: "csa", title: "Cloud Service Agreement" },
        },
      ]}
      definition={nda}
    />
  )

  await expect
    .element(screen.getByText("Cloud Service Agreement selected"))
    .toBeVisible()
  await expect
    .element(screen.getByText("A CSA usually comes with an SLA and a DPA."))
    .toBeVisible()
})

test("a reply cut short doesn't keep saying what it was doing (PAR-47)", async () => {
  const cut: ChatMessage["parts"] = [
    { type: "text", text: "Let me set the purpose.", state: "done" },
    {
      type: "tool-updateFields",
      toolCallId: "call-cut",
      state: "input-streaming",
      input: undefined,
    },
  ]

  const working = await renderWithStore(
    <MessageParts parts={cut} definition={nda} last />
  )
  await expect
    .element(working.getByText("Updating the document…"))
    .toBeVisible()
  await working.unmount()

  const stopped = await renderWithStore(
    <MessageParts parts={cut} definition={nda} last stopped />
  )
  await expect
    .element(stopped.getByText("Let me set the purpose."))
    .toBeVisible()
  expect(stopped.getByText("Updating the document…").query()).toBeNull()
})
