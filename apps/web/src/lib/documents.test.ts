import { definitions } from "@workspace/documents"
import { expect, test } from "vite-plus/test"

import { documentList, documentName } from "./documents"

test("lists every document in the catalog once", () => {
  expect(documentList.map((document) => document.id).toSorted()).toEqual(
    Object.keys(definitions).toSorted()
  )
})

test("names a document by its short name", () => {
  expect(documentName("mutual-nda")).toBe("Mutual NDA")
})
