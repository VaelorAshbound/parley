import {
  Alert,
  AlertAction,
  AlertDescription,
} from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import {
  ChevronDownIcon,
  DownloadIcon,
  FileTextIcon,
  FileTypeIcon,
  InfoIcon,
  XIcon,
} from "lucide-react"

import {
  barButton,
  type Placement,
} from "@/features/document-preview/placement"
import type { Orpc } from "@/lib/orpc"

import { useDownload, type Download } from "./use-download"

// The ways to download a draft (spec §1 Layout: Download (PDF/DOCX) in the
// document panel's header), and what a refused download says. Each limit
// comes with the way past it: an account, a confirmed email, or Pro.

/** The icon of a button: a spinner while the file is being made. */
function Busy({ busy }: { busy: boolean }) {
  return busy ? (
    <Spinner data-icon="inline-start" aria-label="Making your file" />
  ) : (
    <DownloadIcon data-icon="inline-start" />
  )
}

/**
 * The document's menu: PDF, or Word for Pro. In the panel header, or as the
 * main button of the phone's bottom bar (`bar`), where it opens upward.
 */
export function DownloadMenu({
  download,
  placement = "header",
}: {
  download: Download
  placement?: Placement
}) {
  const busy = download.pending !== undefined
  const bar = placement === "bar"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant={bar ? "default" : "outline"}
            disabled={busy}
            className={cn(bar && barButton)}
          />
        }
      >
        <Busy busy={busy} />
        Download
        {!bar && (
          <ChevronDownIcon data-icon="inline-end" className="text-ink-3" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={bar ? "center" : "end"}
        side={bar ? "top" : "bottom"}
        sideOffset={bar ? 8 : 4}
        className="w-auto min-w-44"
      >
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => download.start("pdf")}>
            <FileTextIcon />
            PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => download.start("docx")}>
            <FileTypeIcon />
            Word
            <Badge variant="secondary" className="ml-auto">
              Pro
            </Badge>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Why the last download didn't happen, with the way past it. */
export function DownloadProblem({
  download,
  className,
}: {
  download: Download
  className?: string
}) {
  const { problem } = download
  if (!problem) return null
  return (
    <Alert className={cn("enter", className)}>
      <InfoIcon />
      <AlertDescription className="text-foreground">
        {problem.message}
      </AlertDescription>
      {problem.action && (
        <a
          href={problem.action.href}
          className={cn(
            buttonVariants({ size: "sm" }),
            "col-start-2 mt-2 w-fit"
          )}
        >
          {problem.action.label}
        </a>
      )}
      <AlertAction>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Close message"
          onClick={download.dismiss}
        >
          <XIcon />
        </Button>
      </AlertAction>
    </Alert>
  )
}

/** The chat's "complete" card: one click to the PDF. */
export function DownloadButton({
  orpc,
  draftId,
}: {
  orpc: Orpc
  draftId: string
}) {
  const download = useDownload(orpc, draftId)
  const busy = download.pending !== undefined
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        className="w-fit"
        disabled={busy}
        onClick={() => download.start("pdf")}
      >
        <Busy busy={busy} />
        Download PDF
      </Button>
      <DownloadProblem download={download} />
    </div>
  )
}
