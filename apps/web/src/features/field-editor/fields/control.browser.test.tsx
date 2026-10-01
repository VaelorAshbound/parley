import { act } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { expect, test, vi } from "vite-plus/test"
import { page, userEvent } from "vite-plus/test/browser"

import { useAppForm } from "@/lib/form"

function SignInForm({ onSubmit }: { onSubmit: (password: string) => void }) {
  const form = useAppForm({
    defaultValues: { password: "" },
    onSubmit: ({ value }) => onSubmit(value.password),
  })
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <form.AppField name="password">
        {(field) => (
          <field.PasswordField
            label="Password"
            autoComplete="current-password"
          />
        )}
      </form.AppField>
      <button type="submit">Sign in</button>
    </form>
  )
}

test("keeps what was typed before the page hydrated, and submits it", async () => {
  const onSubmit = vi.fn<(password: string) => void>()
  const form = <SignInForm onSubmit={onSubmit} />
  // The server's HTML, typed into before React takes over (a slow phone:
  // the text shows, but the form's copy of it is still empty).
  const container = document.createElement("div")
  container.innerHTML = renderToString(form)
  document.body.appendChild(container)
  const input = container.querySelector("input")
  if (!input) throw new Error("No input")
  input.value = "correct horse 1"

  await act(async () => {
    hydrateRoot(container, form)
  })
  await userEvent.click(page.getByRole("button", { name: "Sign in" }))

  await vi.waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith("correct horse 1")
  )
  container.remove()
})
