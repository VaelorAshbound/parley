import { definitions } from "@workspace/documents"
import { expect, test } from "vite-plus/test"
import { render } from "vitest-browser-react"

import type { ChatMessage } from "@/server/ai/chat"

import { MessageParts } from "./message-parts"

const nda = definitions["mutual-nda"]

function changed(key: string, after: unknown): ChatMessage["parts"][number] {
  return {
    type: "tool-updateFields",
    toolCallId: `call-${key}`,
    state: "output-available",
    input: { changes: [{ key, value: after, explanation: "Set." }] },
    output: {
      applied: [{ key, after, explanation: "Set." }],
      rejected: [],
      inverse: [],
    },
  }
}

test("names a change by its field and shows the value in the document's words", async () => {
  const screen = await render(
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
  const screen = await render(<MessageParts parts={[part]} definition={nda} />)

  await expect.element(screen.getByText("Ana Diaz, CEO")).toBeVisible()
})

test("keeps bold words and paragraphs, and never renders HTML", async () => {
  const screen = await render(
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
