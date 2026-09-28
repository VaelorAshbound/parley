import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

import {
  definitionOf,
  definitions,
  isDocumentId,
  type DocumentId,
} from "@workspace/documents"
import type { TestProject } from "vite-plus/test/node"
import { getPlatformProxy } from "wrangler"

import { examples } from "../../../../packages/documents/test/examples"
import { browserRunPrinter, buildFile } from "../../src/server/files"

// Makes the real files for `pnpm test:real` (T31), once per run, in Node:
// every agreement fully filled (its example), as a PDF printed by real
// Browser Run and as a Word file. The code is the app's own (buildFile,
// browserRunPrinter); only the BROWSER binding comes from wrangler's
// platform proxy, which reaches the real service on the owner's account.
// Each PDF is a few seconds of Browser Run time, so REAL_DOCS=mutual-nda,psa
// makes only those.

export type RealExport = {
  id: DocumentId
  /** Paths of the files, for the browser's readFile. */
  pdf: string
  docx: string
  pdfName: string
  docxName: string
}

declare module "vite-plus/test" {
  interface ProvidedContext {
    realExports: RealExport[]
  }
}

/** The documents to make: REAL_DOCS, or all of them. */
function chosen(): DocumentId[] {
  const only = process.env.REAL_DOCS?.split(",").map((each) => each.trim())
  if (!only) return Object.keys(definitions).filter(isDocumentId)
  const unknown = only.filter((each) => !isDocumentId(each))
  if (unknown.length > 0)
    throw new Error(`REAL_DOCS: unknown documents ${unknown.join(", ")}`)
  return only.filter(isDocumentId)
}

export default async function setup(project: TestProject) {
  const out = join(import.meta.dirname, "output")
  const ids = chosen()
  const files = (id: DocumentId) => ({
    pdf: join(out, `${id}.pdf`),
    docx: join(out, `${id}.docx`),
  })

  // REAL_REUSE=1 reads back the files of the last run instead of printing
  // again: for approving baselines or changing the checks, at no cost.
  if (process.env.REAL_REUSE === "1") {
    project.provide(
      "realExports",
      ids.map((id) => ({
        id,
        ...files(id),
        pdfName: `Real export – ${definitionOf(id).name}.pdf`,
        docxName: `Real export – ${definitionOf(id).name}.docx`,
      }))
    )
    return
  }

  await rm(out, { recursive: true, force: true })
  await mkdir(out, { recursive: true })
  const proxy = await getPlatformProxy<Env>({
    configPath: join(import.meta.dirname, "../../wrangler.jsonc"),
    remoteBindings: true,
  })
  try {
    const print = browserRunPrinter(proxy.env.BROWSER)
    const made = await Promise.all(
      ids.map(async (id): Promise<RealExport> => {
        const definition = definitionOf(id)
        const draft = {
          title: "Real export",
          definition,
          values: definition.draftSchema.parse(examples[id]),
        }
        const [pdf, docx] = await Promise.all([
          buildFile("pdf", draft, print),
          buildFile("docx", draft, print),
        ])
        const paths = files(id)
        await writeFile(paths.pdf, new Uint8Array(await pdf.file.arrayBuffer()))
        await writeFile(
          paths.docx,
          new Uint8Array(await docx.file.arrayBuffer())
        )
        return {
          id,
          ...paths,
          pdfName: pdf.file.name,
          docxName: docx.file.name,
        }
      })
    )
    project.provide("realExports", made)
  } finally {
    await proxy.dispose()
  }
}
