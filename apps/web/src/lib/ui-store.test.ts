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
