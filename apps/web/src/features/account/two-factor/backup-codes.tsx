import { Button } from "@workspace/ui/components/button"
import { CheckIcon, CopyIcon, DownloadIcon } from "lucide-react"
import { useState } from "react"

/**
 * The 10 backup codes, shown once (Better Auth keeps them encrypted and
 * never shows them again), with Copy and Download so they are easy to keep.
 */
export function BackupCodes({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false)
  const text = codes.join("\n") + "\n"

  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "parley-backup-codes.txt"
    link.click()
    // After the download has started.
    setTimeout(() => URL.revokeObjectURL(url), 0)
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
          onClick={() => void copy()}
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
    </div>
  )
}
