import { expect, test } from "vite-plus/test"

import { createUiStore } from "./ui-store"

// On Workers one isolate renders many users' pages; each page gets its own
// store from the provider, so one user's state can't reach another's.
test("each store starts empty and keeps its own state", () => {
  const first = createUiStore()
  const second = createUiStore()

  first.getState().markChanged(["governingLaw"])

  expect(first.getState().changed).toEqual({ governingLaw: 1 })
  expect(second.getState().changed).toEqual({})
})

test("counts each change, so the same field can ink in again", () => {
  const store = createUiStore()

  store.getState().markChanged(["purpose", "party1"])
  store.getState().markChanged(["purpose"])

  expect(store.getState().changed).toEqual({ purpose: 3, party1: 2 })
  // The panel scrolls to the first field of the latest change.
  expect(store.getState().focus).toEqual({ field: "purpose", seq: 3 })
})

test("settles the highlights when the next message is sent", () => {
  const store = createUiStore()
  store.getState().markChanged(["purpose"])

  store.getState().settle()

  expect(store.getState().changed).toEqual({})
})

test("tells the phone's Document tab about changes until it is opened", () => {
  const store = createUiStore()

  store.getState().markChanged(["purpose"])
  expect(store.getState().unseen).toBe(true)

  store.getState().seeDocument()
  expect(store.getState().unseen).toBe(false)
})

test("remembers which AI changes were undone", () => {
  const store = createUiStore()

  store.getState().setUndo("call-1:purpose", "undone")

  expect(store.getState().undo).toEqual({ "call-1:purpose": "undone" })
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
