import { expect, test } from "vite-plus/test"

import { single } from "../src/queries/rows.ts"

test("single returns the one row", () => {
  expect(single([{ id: 1 }])).toEqual({ id: 1 })
})

test("single throws when there is no row", () => {
  expect(() => single([])).toThrow("Expected a row, got none")
})
