import { definitions, render as renderDocument } from "@workspace/documents"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { describe, expect, test, vi } from "vite-plus/test"
import { userEvent } from "vite-plus/test/browser"
import { render } from "vitest-browser-react"

import { DocumentView } from "./document-view"

const nda = definitions["mutual-nda"]
const filled = nda.draftSchema.parse({
  purpose: "Evaluating a partnership.",
  effectiveDate: "2026-10-01",
  mndaTerm: { option: "expires", value: { amount: 2, unit: "years" } },
  governingLaw: { state: "DE", courtLocation: "New Castle" },
  party1: { company: "Acme Analytics, Inc.", name: "Ana Diaz" },
})

async function show(values: typeof filled, editing?: string) {
  const onEdit = vi.fn<(path: string) => void>()
  const screen = await render(
    <TooltipProvider>
      <DocumentView
        document={renderDocument(nda, values)}
        editing={editing}
        onEdit={onEdit}
        renderEditor={(key) => <p>Editing {key}</p>}
      />
    </TooltipProvider>
  )
  return { screen, onEdit }
}

describe("the live document", () => {
  test("shows each empty field as a named chip, not a blank", async () => {
    const { screen } = await show({})

    await expect
      .element(screen.getByRole("button", { name: "Edit Purpose" }))
      .toHaveTextContent("Purpose")
    await expect
      .element(
        screen.getByRole("button", { name: "Edit Party 1: Company, empty" })
      )
      .toHaveTextContent("Company")
  })

  test("shows filled values in the document's words", async () => {
    const { screen } = await show(filled)

    const term = screen.getByRole("button", { name: "Edit MNDA Term" })
    await expect.element(term).toBeVisible()
    expect(term.element().textContent).toContain(
      "Expires 2 years from Effective Date."
    )
    await expect
      .element(
        screen.getByRole("button", {
          name: "Edit Party 1: Company, Acme Analytics, Inc.",
        })
      )
      .toBeVisible()
  })

  test("marks the picked option of a choice and fades the others", async () => {
    const { screen } = await show(filled)
    const term = screen.getByRole("button", { name: "Edit MNDA Term" })

    await expect
      .element(term.getByRole("img", { name: "Selected" }))
      .toBeVisible()
    await expect
      .element(term.getByRole("img", { name: "Not selected" }))
      .toBeVisible()
  })

  test("asks to edit the field of the row you click", async () => {
    const { screen, onEdit } = await show(filled)

    await screen.getByRole("button", { name: "Edit Purpose" }).click()
    await screen
      .getByRole("button", { name: "Edit Party 1: Name, Ana Diaz" })
      .click()

    expect(onEdit.mock.calls).toEqual([["purpose"], ["party1.name"]])
  })

  test("asks to edit the part of the row you click", async () => {
    const { screen, onEdit } = await show(filled)

    await screen.getByText("courts located in New Castle, DE").click()

    expect(onEdit).toHaveBeenCalledWith("governingLaw.courtLocation")
  })

  test("shows the value behind a term of the standard terms on hover", async () => {
    const { screen } = await show(filled)
    const term = screen
      .getByRole("button", {
        name: "Purpose (Purpose: Evaluating a partnership.)",
      })
      .first()

    await userEvent.hover(term)

    await expect
      .element(
        screen.getByText("Purpose: Evaluating a partnership.", { exact: true })
      )
      .toBeVisible()
  })

  test("puts the editor in place of the row being edited", async () => {
    const { screen } = await show(filled, "mndaTerm")

    await expect.element(screen.getByText("Editing mndaTerm")).toBeVisible()
    await expect
      .element(screen.getByRole("button", { name: "Edit MNDA Term" }))
      .not.toBeInTheDocument()
    await expect
      .element(screen.getByRole("heading", { name: "MNDA Term" }))
      .toBeVisible()
  })

  test("puts a party's editor under the signatures", async () => {
    const { screen } = await show(filled, "party2.email")

    await expect.element(screen.getByText("Editing party2")).toBeVisible()
  })
})
