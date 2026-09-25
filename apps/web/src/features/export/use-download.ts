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
    mutationFn: ({ format, id }: { format: ExportFormat; id: string }) =>
      orpc.export[format].call({ id }),
    onSuccess: save,
  })
  // The draft page stays mounted when another draft opens: what happened to
  // the last draft's download isn't this one's.
  const current = variables?.id === draftId ? variables : undefined
  return {
    start: (format) => mutate({ format, id: draftId }),
    pending: isPending ? current?.format : undefined,
    problem:
      error && current
        ? exportProblem(error, {
            format: current.format,
            draftPath: `/d/${draftId}`,
          })
        : undefined,
    dismiss: reset,
  }
}
