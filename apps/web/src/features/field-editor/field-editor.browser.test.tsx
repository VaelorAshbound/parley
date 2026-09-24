import { definitions, type DocumentDefinition } from "@workspace/documents"
import { describe, expect, test, vi } from "vite-plus/test"
import { page, userEvent } from "vite-plus/test/browser"
import { render } from "vitest-browser-react"

import { FieldEditor, type Recovery } from "./field-editor"

const nda = definitions["mutual-nda"]

async function edit(
  fieldKey: string,
  {
    definition = nda,
    values = {},
    focus,
    recovery,
  }: {
    definition?: DocumentDefinition
    values?: Record<string, unknown>
    focus?: string
    recovery?: Recovery
  } = {}
) {
  const onSave = vi.fn<(change: unknown, inputs: object) => void>()
  const onCancel = vi.fn<() => void>()
  const screen = await render(
    <FieldEditor
      definition={definition}
      values={values}
      fieldKey={fieldKey}
      focus={focus}
      recovery={recovery}
      onSave={onSave}
      onCancel={onCancel}
    />
  )
  return { screen, onSave, onCancel }
}

describe("the inline editor", () => {
  test("saves a text field on Enter", async () => {
    const { screen, onSave } = await edit("purpose", {
      values: { purpose: "Old." },
    })
    const box = screen.getByRole("textbox", { name: "Purpose" })

    await expect.element(box).toHaveFocus()
    await expect.element(box).toHaveValue("Old.")
    await userEvent.clear(box)
    await userEvent.type(box, "Hiring an agency.{Enter}")

    expect(onSave).toHaveBeenCalledWith("Hiring an agency.", expect.anything())
  })

  test("keeps a line break with Shift+Enter in long text", async () => {
    const { screen, onSave } = await edit("purpose")
    const box = screen.getByRole("textbox", { name: "Purpose" })

    await userEvent.type(box, "One{Shift>}{Enter}{/Shift}Two{Enter}")

    expect(onSave).toHaveBeenCalledWith("One\nTwo", expect.anything())
  })

  test("cancels on Escape without saving", async () => {
    const { screen, onSave, onCancel } = await edit("purpose")

    await userEvent.type(screen.getByRole("textbox"), "Draft{Escape}")

    expect(onCancel).toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
  })

  test("clears a field emptied by hand", async () => {
    const { screen, onSave } = await edit("modifications", {
      values: { modifications: "None." },
    })

    await userEvent.clear(screen.getByRole("textbox"))
    await screen.getByRole("button", { name: "Save" }).click()

    expect(onSave).toHaveBeenCalledWith(null, expect.anything())
  })

  test("focuses the part that was clicked", async () => {
    const { screen } = await edit("party1", { focus: "party1.email" })

    await expect
      .element(screen.getByRole("textbox", { name: "Email" }))
      .toHaveFocus()
  })

  test("shows a wrong part's error on that part, and doesn't save", async () => {
    const { screen, onSave } = await edit("party1")
    const email = screen.getByRole("textbox", { name: "Email" })

    await userEvent.type(email, "ana at acme{Enter}")

    await expect.element(email).toHaveAttribute("aria-invalid", "true")
    await expect
      .element(screen.getByText("Use a real email address."))
      .toBeVisible()
    expect(onSave).not.toHaveBeenCalled()

    await userEvent.clear(email)
    await userEvent.type(email, "ana@acme.test{Enter}")
    expect(onSave).toHaveBeenCalledWith(
      {
        company: null,
        name: null,
        title: null,
        email: "ana@acme.test",
        address: null,
      },
      expect.anything()
    )
  })

  test("shows a rule about the whole field above its inputs", async () => {
    const { screen, onSave } = await edit("party2", {
      values: { party1: { company: "Acme" } },
    })

    await userEvent.type(
      screen.getByRole("textbox", { name: "Company" }),
      "acme{Enter}"
    )

    await expect
      .element(screen.getByText("The two parties must be different companies."))
      .toBeVisible()
    expect(onSave).not.toHaveBeenCalled()
  })

  test("picks a choice and fills its blank", async () => {
    const { screen, onSave } = await edit("mndaTerm")

    await screen
      .getByRole("radio", { name: /Continues until terminated/ })
      .click()
    await screen.getByRole("radio", { name: /Expires/ }).click()
    await userEvent.type(
      screen.getByRole("spinbutton", { name: "MNDA length" }),
      "3"
    )
    await screen.getByRole("combobox", { name: "Unit" }).click()
    await screen.getByRole("option", { name: "years" }).click()
    await screen.getByRole("button", { name: "Save" }).click()

    expect(onSave).toHaveBeenCalledWith(
      { option: "expires", value: { amount: 3, unit: "years" } },
      expect.anything()
    )
  })

  test("picks a state from the list", async () => {
    const { screen, onSave } = await edit("governingLaw")

    await userEvent.type(
      screen.getByRole("combobox", { name: "State" }),
      "Dela"
    )
    await screen.getByRole("option", { name: "Delaware" }).click()
    await userEvent.type(
      screen.getByRole("textbox", { name: "Courts" }),
      "New Castle{Enter}"
    )

    expect(onSave).toHaveBeenCalledWith(
      { state: "DE", courtLocation: "New Castle" },
      expect.anything()
    )
  })

  test("adds and removes rows of a list", async () => {
    const sla = definitions.sla
    const { screen, onSave } = await edit("uptimeCredit", { definition: sla })
    const firstLabel =
      Object.values(sla.fields.uptimeCredit.item)[0]?.label ?? ""

    await screen.getByRole("button", { name: "Add a row" }).click()
    await expect
      .element(screen.getByRole("group", { name: "Row 2" }))
      .toBeVisible()
    await screen.getByRole("button", { name: "Remove row 2" }).click()
    await expect
      .element(screen.getByRole("group", { name: "Row 2" }))
      .not.toBeInTheDocument()
    await expect
      .element(
        screen.getByRole("group", { name: "Row 1" }).getByLabelText(firstLabel)
      )
      .toBeVisible()
    expect(onSave).not.toHaveBeenCalled()
  })

  test("shows what the server refused on the input it names", async () => {
    await edit("party1", {
      recovery: {
        inputs: { "party1/email": "ana@acme.test" },
        issues: [{ path: ["email"], message: "This email is taken." }],
      },
    })

    await expect
      .element(page.getByRole("textbox", { name: "Email" }))
      .toHaveValue("ana@acme.test")
    await expect.element(page.getByText("This email is taken.")).toBeVisible()
  })
})
