import { isDocumentId, type DocumentDefinition } from "@workspace/documents"
import {
  Marker,
  MarkerContent,
  MarkerIcon,
} from "@workspace/ui/components/marker"
import { FileTextIcon, PenLineIcon } from "lucide-react"
import type { ReactNode } from "react"

import { documentName } from "@/lib/documents"
import type { ChatMessage } from "@/server/ai/chat"

// One message's parts in the chat (spec §1 "The wow moment"): the assistant's
// words, the agreement it picked, and each change it made to the document.
// T18 adds the Undo, the highlight and the motion.

type Part = ChatMessage["parts"][number]

export function MessageParts({
  parts,
  definition,
}: {
  parts: Part[]
  /** The draft's agreement, to name the fields a change touched. */
  definition: DocumentDefinition | null
}) {
  return parts.map((part, index) => {
    switch (part.type) {
      case "text":
        return <PlainText key={index} text={part.text} />
      case "tool-chooseDocument":
        return part.state === "output-available" ? (
          <Marker key={index} variant="separator">
            <MarkerContent className="flex items-center gap-1.5">
              <FileTextIcon aria-hidden="true" className="size-3.5" />
              {documentName(
                isDocumentId(part.output.documentId)
                  ? part.output.documentId
                  : null
              )}{" "}
              selected
            </MarkerContent>
          </Marker>
        ) : part.state === "output-error" ? null : (
          <Working key={index}>Choosing the agreement…</Working>
        )
      case "tool-updateFields":
        if (part.state === "output-available")
          return part.output.applied.length > 0 ? (
            <Changes
              key={index}
              changes={part.output.applied}
              definition={definition}
            />
          ) : null
        if (part.state === "output-error") return null
        return <Working key={index}>Updating the document…</Working>
      default:
        return null
    }
  })
}

/** A tool at work: a status that screen readers announce, with the shimmer. */
function Working({ children }: { children: ReactNode }) {
  return (
    // <output> is a live status: screen readers hear the work in progress.
    <Marker render={<output />}>
      <MarkerIcon>
        <PenLineIcon />
      </MarkerIcon>
      <MarkerContent className="shimmer">{children}</MarkerContent>
    </Marker>
  )
}

/** Each field a change set, as "Purpose → Evaluating a partnership". */
function Changes({
  changes,
  definition,
}: {
  changes: {
    key: string
    before?: unknown
    after?: unknown
    explanation: string
  }[]
  definition: DocumentDefinition | null
}) {
  return (
    <ul
      aria-label="Changes to the document"
      className="flex flex-col overflow-hidden rounded-xl border bg-card text-[13.5px]"
    >
      {changes.map((change) => {
        const field = definition?.fields[change.key]
        const shown =
          change.after === undefined
            ? "cleared"
            : field?.merges === "parts"
              ? changedParts(change.before, change.after)
              : (field?.format(change.after) ?? "set")
        return (
          <li
            key={change.key}
            title={change.explanation}
            className="flex h-10.5 items-center gap-2.5 border-t px-3.5 first:border-t-0"
          >
            <PenLineIcon aria-hidden="true" className="size-3.5 text-ink-3" />
            <span className="shrink-0 text-ink-2">
              {field?.label ?? change.key}
            </span>
            <span aria-hidden="true" className="text-ink-3">
              →
            </span>
            <span className="sr-only">set to</span>
            <span className="min-w-0 flex-1 truncate font-serif text-[15px] text-blue-ink">
              {shown}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * What changed in a field with parts, like a party: "Ana Diaz, CEO". The
 * field's own headline (its company) would hide the name and email.
 */
function changedParts(before: unknown, after: unknown) {
  const old = record(before)
  const texts = Object.entries(record(after)).flatMap(([part, value]) =>
    typeof value === "string" && value !== old[part] ? [value] : []
  )
  return texts.length > 0 ? texts.join(", ") : "updated"
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null ? { ...value } : {}
}

/**
 * The assistant's words. It writes plain text (its instructions say so);
 * blank lines make paragraphs and **bold** is kept, all as React text, so
 * nothing the model writes becomes HTML.
 */
export function PlainText({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/).filter((each) => each.trim() !== "")
  return (
    <div className="typeset typeset-chat">
      {paragraphs.map((paragraph, index) => (
        <p key={index}>
          {paragraph
            .split(/(\*\*[^*]+\*\*)/)
            .map((piece, at) =>
              piece.startsWith("**") &&
              piece.endsWith("**") &&
              piece.length > 4 ? (
                <strong key={at}>{piece.slice(2, -2)}</strong>
              ) : (
                <Lines key={at} text={piece} />
              )
            )}
        </p>
      ))}
    </div>
  )
}

function Lines({ text }: { text: string }) {
  const lines = text.split("\n")
  return lines.map((line, index) => (
    <span key={index}>
      {line}
      {index < lines.length - 1 && <br />}
    </span>
  ))
}
