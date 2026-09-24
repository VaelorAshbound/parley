import { expect, test } from "vite-plus/test"

import { createUiStore } from "./ui-store"

// On Workers one isolate renders many users' pages; each page gets its own
// store from the provider, so one user's state can't reach another's.
test("each store starts empty and keeps its own state", () => {
  const first = createUiStore()
  const second = createUiStore()

  first.getState().highlightField("governingLaw")

  expect(first.getState().highlightedField).toBe("governingLaw")
  expect(second.getState().highlightedField).toBeNull()
})

test("keeps a refused save until it is taken back", () => {
  const store = createUiStore()
  const refused = {
    draftId: "d1",
    fieldKey: "party1",
    inputs: { "party1/email": "ana@acme.test" },
    issues: [{ path: ["email"], message: "Taken." }],
  }

  store.getState().setRefused(refused)
  expect(store.getState().refused).toEqual(refused)

  store.getState().setRefused(null)
  expect(store.getState().refused).toBeNull()
})
