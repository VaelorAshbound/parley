import { readFileSync } from "node:fs"

import { z } from "../zod.ts"

// catalog.json and templates/ at the repo root are Common Paper's files. The
// build script and the tests read them from disk; the app never does.

const root = new URL("../../../../", import.meta.url)

export const COVER_PAGE_FILE = "Mutual-NDA-coverpage.md"

const catalogSchema = z.array(
  z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    filename: z.string().regex(/^[\w-]+\.md$/),
  })
)

export type CatalogEntry = z.infer<typeof catalogSchema>[number]

export function readCatalog() {
  return catalogSchema.parse(
    JSON.parse(readFileSync(new URL("catalog.json", root), "utf8"))
  )
}

export function readTemplate(filename: string) {
  return readFileSync(new URL(`templates/${filename}`, root), "utf8")
}

/** "Mutual-NDA.md" → "mutual-nda", the name of its generated module. */
export function templateId(filename: string) {
  return filename.replace(/\.md$/, "").toLowerCase()
}
