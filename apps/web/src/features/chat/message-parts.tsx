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
  last = false,
}: {
  parts: Part[]
  /** The draft's agreement, to name the fields a change touched. */
  definition: DocumentDefinition | null
  /** Undoes one AI change (useUndo); without it, no Undo buttons show. */
  onUndo?: (undo: { row: string; change: ChangeRequest }) => void
  /** Sends the answers to open questions; only the live turn has it. */
  onAnswer?: (answer: { toolCallId: string; answers: Answers }) => void
  /** The newest message: its open questions are still coming, not closed. */
  last?: boolean
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
              call={part.toolCallId}
              changes={part.output.applied}
              inverse={part.output.inverse}
              definition={definition}
              onUndo={onUndo}
            />
          ) : null
        if (part.state === "output-error") return null
        return <Working key={index}>Updating the document…</Working>
      case "tool-askQuestions":
        if (part.state === "input-streaming")
          return <Working key={index}>Writing questions…</Working>
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
          return <Working key={index}>Writing questions…</Working>
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
            <Complete key={index} definition={definition} />
          ) : null
        if (part.state === "output-error") return null
        return <Working key={index}>Checking the document…</Working>
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

/**
 * markComplete found nothing missing: the agreement is ready. T24 adds the
 * Export button here, once export exists.
 */
function Complete({ definition }: { definition: DocumentDefinition | null }) {
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
      </div>
    </div>
  )
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
        return (
          <Marker
            key={change.key}
            render={<li />}
            title={change.explanation}
            className="h-10.5 gap-2.5 border-t pr-1.5 pl-3.5 text-[13.5px] first:border-t-0"
          >
            <MarkerIcon>
              <PenLineIcon className="size-3.5 text-ink-3" />
            </MarkerIcon>
            <span className="shrink-0 text-ink-2">
              {field?.label ?? change.key}
            </span>
            <span aria-hidden="true" className="text-ink-3">
              →
            </span>
            <span className="sr-only">set to</span>
            <MarkerContent
              className={cn(
                "flex-1 truncate font-serif text-[15px] text-blue-ink",
                state === "undone" && "text-ink-3 line-through"
              )}
            >
              {shown(field, change)}
            </MarkerContent>
            {state === "undone" ? (
              <span className="px-2.5 text-xs text-muted-foreground">
                Undone
              </span>
            ) : state === "stale" ? (
              <span className="px-2.5 text-xs text-muted-foreground">
                Changed since
              </span>
            ) : onUndo && back ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7.5 text-[12.5px] text-ink-2"
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
