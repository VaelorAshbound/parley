import { useMutation } from "@tanstack/react-query"

import type { Orpc } from "@/lib/orpc"
import type { ExportFormat } from "@/server/quota"

import { exportProblem, type ExportProblem } from "./problem"

// Downloads a draft as a PDF or a Word file (T24). The server makes the file
// and names it (`<Title> – <Document>.pdf`); oRPC hands it over as a File,
// named from its Content-Disposition:
// https://orpc.dev/docs/file-upload-download

export type Download = {
  start: (format: ExportFormat) => void
  /** The format being made right now. */
  pending: ExportFormat | undefined
  /** Why the last download didn't happen, and the way past it. */
  problem: ExportProblem | undefined
  dismiss: () => void
}

/**
 * Hands the file to the browser to save. The URL is freed a little later:
 * some browsers still read it after click() returns.
 */
function save(file: File) {
  const url = URL.createObjectURL(file)
  const link = document.createElement("a")
  link.href = url
  link.download = file.name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function useDownload(orpc: Orpc, draftId: string): Download {
  const { mutate, isPending, variables, error, reset } = useMutation({
    mutationFn: (format: ExportFormat) =>
      orpc.export[format].call({ id: draftId }),
    onSuccess: save,
  })
  return {
    start: (format) => mutate(format),
    pending: isPending ? variables : undefined,
    problem:
      error && variables
        ? exportProblem(error, {
            format: variables,
            draftPath: `/d/${draftId}`,
          })
        : undefined,
    dismiss: reset,
  }
}
