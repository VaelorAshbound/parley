import { Button } from "@workspace/ui/components/button"
import { CheckIcon, CopyIcon, DownloadIcon } from "lucide-react"
import { useState } from "react"

/**
 * The 10 backup codes, shown once (Better Auth keeps them encrypted and
 * never shows them again), with Copy and Download so they are easy to keep.
 */
export function BackupCodes({ codes }: { codes: string[] }) {
  const [copy, setCopy] = useState<"idle" | "copied" | "refused">("idle")
  const copied = copy === "copied"
  const text = codes.join("\n") + "\n"

  async function copyCodes() {
    try {
      await navigator.clipboard.writeText(text)
      setCopy("copied")
    } catch {
      // No clipboard permission, or the page lost focus (PAR-20).
      setCopy("refused")
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "parley-backup-codes.txt"
    link.click()
    // Safari reads the file after click() returns, and cancels the
    // download if the URL is already gone: let go of it a second later.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="flex flex-col gap-3">
      <ul
        aria-label="Backup codes"
        className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg bg-muted p-3 text-center font-mono text-sm tabular-nums"
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => void copyCodes()}
        >
          {copied ? (
            <CheckIcon data-icon="inline-start" />
          ) : (
            <CopyIcon data-icon="inline-start" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={download}
        >
          <DownloadIcon data-icon="inline-start" />
          Download
        </Button>
      </div>
      {copy === "refused" && (
        <p role="alert" className="text-sm text-destructive">
          Couldn’t copy. Use Download.
        </p>
      )}
    </div>
  )
}
