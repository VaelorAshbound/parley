import {
  isDocumentId,
  type AnyField,
  type ChangeRequest,
  type DocumentDefinition,
} from "@workspace/documents"
import { Button } from "@workspace/ui/components/button"
import {
  Marker,
  MarkerContent,
  MarkerIcon,
} from "@workspace/ui/components/marker"
import { cn } from "@workspace/ui/lib/utils"
import {
  CheckIcon,
  FileTextIcon,
  ListChecksIcon,
  PenLineIcon,
  SquareIcon,
  Undo2Icon,
} from "lucide-react"
import type { ReactNode } from "react"

import { documentName } from "@/lib/documents"
import { useUiStore } from "@/lib/ui-store"
import type { ChatMessage } from "@/server/ai/chat"
import { isShown, type Answers } from "@/server/ai/questions"

import { AiQuestionnaire, type QuestionSet } from "./ai-questionnaire"

// One message's parts in the chat (spec §1 "The wow moment"): the assistant's
// words, the agreement it picked, each change it made to the document (with
// an Undo), its questions, and the note that the agreement is complete.

type Part = ChatMessage["parts"][number]

export function MessageParts({
  parts,
  definition,
  onUndo,
  onAnswer,
  download,
  last = false,
  stopped = false,
}: {
  parts: Part[]
  /** The draft's agreement, to name the fields a change touched. */
  definition: DocumentDefinition | null
  /** Undoes one AI change (useUndo); without it, no Undo buttons show. */
  onUndo?: (undo: { row: string; change: ChangeRequest }) => void
  /** Sends the answers to open questions; only the live turn has it. */
  onAnswer?: (answer: { toolCallId: string; answers: Answers }) => void
  /** The way to download the finished agreement, on its "complete" card. */
  download?: ReactNode
  /** The newest message: its open questions are still coming, not closed. */
  last?: boolean
  /** Cut short (PAR-47): what it was working on won't finish. */
  stopped?: boolean
}) {
  return parts.map((part, index) => {
    switch (part.type) {
      case "text":
        return <PlainText key={index} text={part.text} />
      case "tool-chooseDocument":
        return part.state === "output-available" ? (
          <div key={index}>
            <Marker variant="separator">
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
            {/* The one-line reason for the pick (user story 2). */}
            <p className="mt-1 text-center text-small text-pretty text-ink-2">
              {part.input.reason}
            </p>
          </div>
        ) : part.state === "output-error" ? null : (
          <Working key={index} stopped={stopped}>
            Choosing the agreement…
          </Working>
        )
      case "tool-updateFields":
        if (part.state === "output-available")
          return part.output.applied.length > 0 ? (
            <Changes
              key={index}
              call={part.toolCallId}
              changes={part.output.applied}
              inverse={part.output.inverse}
              definition={definition}
              onUndo={onUndo}
            />
          ) : null
        if (part.state === "output-error") return null
        return (
          <Working key={index} stopped={stopped}>
            Updating the document…
          </Working>
        )
      case "tool-askQuestions":
        if (part.state === "input-streaming")
          return (
            <Working key={index} stopped={stopped}>
              Writing questions…
            </Working>
          )
        if (part.state === "output-available")
          return <Answered key={index} set={part.input} answers={part.output} />
        if (part.state === "input-available" && onAnswer)
          return (
            <AiQuestionnaire
              key={part.toolCallId}
              toolCallId={part.toolCallId}
              set={part.input}
              onAnswer={(answers) =>
                onAnswer({ toolCallId: part.toolCallId, answers })
              }
            />
          )
        if (part.state === "input-available" && last)
          return (
            <Working key={index} stopped={stopped}>
              Writing questions…
            </Working>
          )
        // Replied to in the chat instead, or a set the model got wrong.
        return part.input?.title ? (
          <Marker key={index} className="text-ink-3">
            <MarkerIcon>
              <ListChecksIcon />
            </MarkerIcon>
            <MarkerContent>
              {part.input.title} · answered in the chat
            </MarkerContent>
          </Marker>
        ) : null
      case "tool-markComplete":
        if (part.state === "output-available")
          return part.output.complete ? (
            <Complete key={index} definition={definition} download={download} />
          ) : null
        if (part.state === "output-error") return null
        return (
          <Working key={index} stopped={stopped}>
            Checking the document…
          </Working>
        )
      default:
        return null
    }
  })
}

/**
 * Answered questions, folded to one line: "Key terms answered · 2 years,
 * Texas" (brand.md: the summary row). Skipped questions are left out.
 */
function Answered({
  set,
  answers,
}: {
  set: QuestionSet
  answers: { answers: Answers }
}) {
  const given = answers.answers
  const summary = set.questions
    .filter((question) => isShown(question, given))
    .flatMap((question) =>
      (given[question.name] ?? []).map(
        (value) =>
          question.choices.find((choice) => choice.value === value)?.label ??
          value
      )
    )
    .join(", ")
  return (
    <Marker className="enter min-h-11.5 gap-2.5 rounded-[14px] border bg-card pr-1.5 pl-3 text-[13.5px] text-ink-2">
      <MarkerIcon className="grid size-5.5 shrink-0 place-items-center rounded-full bg-blue-tint text-blue-ink">
        <CheckIcon className="size-3.25" strokeWidth={2.25} />
      </MarkerIcon>
      <MarkerContent className="min-w-0 flex-1 truncate py-2.5">
        {summary ? (
          <>
            {set.title} answered ·{" "}
            <span className="text-foreground">{summary}</span>
          </>
        ) : (
          `${set.title} skipped`
        )}
      </MarkerContent>
    </Marker>
  )
}

/** markComplete found nothing missing: the agreement is ready to download. */
function Complete({
  definition,
  download,
}: {
  definition: DocumentDefinition | null
  download: ReactNode
}) {
  return (
    <div className="enter flex items-start gap-3 rounded-[14px] border bg-card px-3.5 py-3">
      <span
        aria-hidden="true"
        className="mt-0.5 grid size-5.5 shrink-0 place-items-center rounded-full bg-blue-tint text-blue-ink"
      >
        <CheckIcon className="size-3.25" strokeWidth={2.25} />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="font-heading text-[17px] leading-snug font-medium">
          {definition ? `Your ${definition.name} is complete` : "Complete"}
        </p>
        <p className="text-small text-ink-2">
          Every required field is filled. Read it through before you use it.
        </p>
        {download && <div className="mt-2.5">{download}</div>}
      </div>
    </div>
  )
}

/** A tool at work: a status that screen readers announce, with the shimmer. */
function Working({
  children,
  stopped,
}: {
  children: ReactNode
  stopped: boolean
}) {
  if (stopped) return null
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

/**
 * Whether a reply was cut short by Stop or a reload (PAR-47): it ends with
 * the mark, as the server saves it. A reply its answers carried on doesn't.
 */
export function isStopped(parts: readonly Part[]) {
  return parts.at(-1)?.type === "data-interrupted"
}

/**
 * Under a reply cut short by Stop or a reload (PAR-47): a quiet line, and
 * Try again on the latest turn. No Continue (owner, 2026-10-03).
 */
export function StoppedNote({
  onRetry,
  className,
}: {
  /** The latest turn's Try again (PAR-7's real retry); none on older ones. */
  onRetry?: () => void
  className?: string
}) {
  return (
    <p
      className={cn(
        "-mt-1.5 flex min-h-6 items-center gap-1.5 text-small text-muted-foreground",
        className
      )}
    >
      <SquareIcon aria-hidden="true" className="size-2.5 fill-current" />
      <span>Stopped</span>
      {onRetry ? (
        <>
          <span aria-hidden="true">·</span>
          <Button
            type="button"
            variant="link"
            size="xs"
            onClick={onRetry}
            className="-mx-1 h-6 px-1 text-small font-medium text-blue-ink underline-offset-3"
          >
            Try again
          </Button>
        </>
      ) : null}
    </p>
  )
}

/**
 * Each field a change set, as a marker: "MNDA term → 2 years", with an Undo
 * (brand.md: a pen, the field, an arrow, the value in the document's ink).
 */
function Changes({
  call,
  changes,
  inverse,
  definition,
  onUndo,
}: {
  call: string
  changes: {
    key: string
    before?: unknown
    after?: unknown
    explanation: string
  }[]
  inverse: { key: string; value?: unknown; expected?: unknown }[]
  definition: DocumentDefinition | null
  onUndo: ((undo: { row: string; change: ChangeRequest }) => void) | undefined
}) {
  const undo = useUiStore((state) => state.undo)
  return (
    <ul
      aria-label="Changes to the document"
      className="enter flex flex-col overflow-hidden rounded-xl border bg-card"
    >
      {changes.map((change) => {
        const field = definition?.fields[change.key]
        const row = `${call}:${change.key}`
        const state = undo[row]
        const back = inverse.find((each) => each.key === change.key)
        const name = field?.label ?? change.key
        const value = shown(field, change)
        return (
          <Marker
            key={change.key}
            render={<li />}
            // Named by what it did; the explanation (the tooltip) is its
            // description. A list item takes no name from its text.
            aria-label={[
              change.after === undefined
                ? `${name} cleared`
                : `${name} set to ${value}`,
              state === "undone" && "undone",
              state === "stale" && "changed since",
            ]
              .filter(Boolean)
              .join(", ")}
            title={change.explanation}
            // Top-aligned on one 22 px line box: the icon, the field and Undo
            // sit on the value's first line, not between its two (PAR-42).
            className="items-start gap-2.5 border-t py-2.5 pr-1.5 pl-3.5 text-[13.5px] leading-5.5 first:border-t-0"
          >
            <MarkerIcon className="mt-0.75">
              <PenLineIcon className="size-3.5 text-ink-3" />
            </MarkerIcon>
            <span className="shrink-0 text-ink-2">{name}</span>
            <span aria-hidden="true" className="text-ink-3">
              →
            </span>
            <span className="sr-only">set to</span>
            {/* Two lines at most, so a long purpose never fills the chat; the
                whole value is its tooltip and in the row's name (PAR-42). */}
            <MarkerContent
              title={value}
              className={cn(
                "line-clamp-2 flex-1 font-serif text-[15px] leading-5.5 text-pretty text-blue-ink",
                state === "undone" && "text-ink-3 line-through"
              )}
            >
              {value}
            </MarkerContent>
            {state === "undone" ? (
              <span className="px-2.5 text-xs leading-5.5 text-muted-foreground">
                Undone
              </span>
            ) : state === "stale" ? (
              <span className="px-2.5 text-xs leading-5.5 text-muted-foreground">
                Changed since
              </span>
            ) : onUndo && back ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-my-1 h-7.5 text-[12.5px] text-ink-2"
                aria-label={`Undo ${field?.label ?? change.key}`}
                onClick={() =>
                  onUndo({
                    row,
                    // Stored as JSON: an empty value comes back as null.
                    change: {
                      key: back.key,
                      value: back.value ?? null,
                      expected: back.expected ?? null,
                    },
                  })
                }
              >
                <Undo2Icon data-icon="inline-start" />
                Undo
              </Button>
            ) : null}
          </Marker>
        )
      })}
    </ul>
  )
}

/**
 * The value as the row shows it: short where the document is long ("2
 * years", not the whole sentence around it), and for a field with parts,
 * the parts that changed.
 */
function shown(
  field: AnyField | undefined,
  change: { before?: unknown; after?: unknown }
) {
  const { after } = change
  if (after === undefined) return "cleared"
  if (field?.merges === "parts")
    return changedParts(field, change.before, after)
  if (field?.kind === "choice") {
    const option = record(after)
    const picked =
      typeof option.option === "string"
        ? field.options[option.option]
        : undefined
    if (picked?.with && option.value !== undefined)
      return picked.with.format(option.value) ?? field.format(after) ?? "set"
  }
  return field?.format(after) ?? "set"
}

/**
 * What changed in a field with parts, like a party: "Ana Diaz, CEO". The
 * field's own headline (its company) would hide the name and email. A code
 * reads as its name ("DE" → "Delaware").
 */
function changedParts(field: AnyField, before: unknown, after: unknown) {
  const old = record(before)
  const texts = Object.entries(record(after)).flatMap(([part, value]) => {
    if (typeof value !== "string" || value === old[part]) return []
    const named =
      field.kind === "jurisdiction" && part === "state"
        ? field.formatPath(after, part)
        : value
    return [named ?? value]
  })
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
