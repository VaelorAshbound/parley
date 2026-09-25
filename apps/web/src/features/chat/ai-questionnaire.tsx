import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSkip,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@workspace/ui/components/questionnaire"
import { Kbd } from "@workspace/ui/components/kbd"
import { cn } from "@workspace/ui/lib/utils"
import { ChevronLeftIcon } from "lucide-react"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"

import {
  isShown,
  MAX_ANSWER,
  type Answers,
  type Question,
} from "@/server/ai/questions"

// The AI's questions, inline in the chat (spec §1: "a questionnaire appears
// in the chat"; brand.md: the questionnaire card). One step per question,
// letter keys, another answer typed in, Skip for optional ones, and
// questions that only apply after an earlier answer. Picking one answer
// moves on by itself; answers typed so far survive a reload.

export type QuestionSet = { title: string; questions: Question[] }

/** Letters for the keys, as the Questionnaire assigns them. */
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
/** Long enough to see the check land before the next question slides in. */
const ADVANCE_MS = 220

export function AiQuestionnaire({
  toolCallId,
  set,
  onAnswer,
}: {
  toolCallId: string
  set: QuestionSet
  onAnswer: (answers: Answers) => void
}) {
  const storage = `parley:questions:${toolCallId}`
  // What was answered before a reload lives in this browser, which the
  // server render can't see: the form mounts again once hydrated, and only
  // then reads it.
  const hydrated = useSyncExternalStore(
    noChanges,
    () => true,
    () => false
  )

  return (
    <Steps
      key={hydrated ? "client" : "server"}
      set={set}
      saved={() => (hydrated ? load(storage) : null)}
      onChange={(progress) => store(storage, progress)}
      onAnswer={(answers) => {
        forget(storage)
        onAnswer(answers)
      }}
    />
  )
}

type Progress = { item: string; answers: Answers }

/** Hydration is the only change useSyncExternalStore watches for here. */
const noChanges = () => () => {}

function Steps({
  set,
  saved,
  onChange,
  onAnswer,
}: {
  set: QuestionSet
  /** Read once, when the form mounts. */
  saved: () => Progress | null
  onChange: (progress: Progress) => void
  onAnswer: (answers: Answers) => void
}) {
  const { questions } = set
  const [before] = useState(saved)
  const [answers, setAnswers] = useState<Answers>(before?.answers ?? {})
  const [item, setItem] = useState(
    before && questions.some((question) => question.name === before.item)
      ? before.item
      : (questions[0]?.name ?? "")
  )
  // Steps slide in once the user moves; the first one rises in with the
  // message.
  const [moved, setMoved] = useState(false)
  const advance = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(advance.current), [])
  // Letter keys work at once, as the hint says: the question takes focus
  // when it appears, unless the user is typing a message of their own.
  const card = useRef<HTMLElement>(null)
  useEffect(() => {
    const active = document.activeElement
    const typing =
      (active instanceof HTMLTextAreaElement ||
        active instanceof HTMLInputElement) &&
      active.value !== ""
    if (!typing)
      card.current
        ?.querySelector<HTMLElement>("fieldset:not([hidden])")
        ?.focus({ preventScroll: true })
  }, [])

  const current = questions.find((question) => question.name === item)
  const keys = current?.choices.length ?? 0

  const go = (next: string, latest = answers) => {
    clearTimeout(advance.current)
    setMoved(true)
    setItem(next)
    onChange({ item: next, answers: latest })
  }

  return (
    <section
      ref={card}
      aria-label={set.title}
      className="flex flex-col gap-3.5 rounded-[18px] border bg-card px-3.5 pt-3.5 pb-3 shadow-[0_1px_2px_rgba(27,26,23,0.04),0_10px_28px_-14px_rgba(27,26,23,0.16)]"
    >
      <Questionnaire
        item={item}
        onItemChange={(next) => go(next)}
        items={questions.map((question) => ({
          name: question.name,
          required: question.required,
          disabled: !isShown(question, answers),
          choices: question.choices.map(({ value }) => ({ value })),
        }))}
        shortcuts="letters"
        onChange={(event) => {
          const next = read(event.currentTarget, questions)
          setAnswers(next)
          onChange({ item, answers: next })
          // One answer picked: on to the next question, like the design.
          // The pick may bring in a question that depends on it.
          const shown = questions.filter((each) => isShown(each, next))
          const after = shown[shown.findIndex((each) => each.name === item) + 1]
          const { target } = event
          if (
            target instanceof HTMLInputElement &&
            target.type === "radio" &&
            after
          ) {
            clearTimeout(advance.current)
            advance.current = setTimeout(() => go(after.name, next), ADVANCE_MS)
          }
        }}
        onSubmit={(event) => {
          event.preventDefault()
          onAnswer(read(event.currentTarget, questions))
        }}
      >
        <div className="flex items-center gap-3 px-1 pt-0.5">
          <span className="text-label text-ink-3 uppercase">{set.title}</span>
          <QuestionnaireProgress
            aria-label={`${set.title} progress`}
            className="ms-auto flex min-w-0 items-center gap-3"
            render={(props, state) => (
              <div {...props}>
                {state.current} of {state.total}
                <span className="h-1 w-16 overflow-hidden rounded-full bg-rule-sheet">
                  <span
                    className="block h-full origin-left rounded-full bg-blue-ink transition-transform duration-360 ease-(--ease-out) motion-reduce:transition-none"
                    style={{
                      transform: `scaleX(${state.total ? state.current / state.total : 0})`,
                    }}
                  />
                </span>
              </div>
            )}
          />
        </div>

        {questions.map((question) => {
          const earlier = before?.answers[question.name] ?? []
          const typed = earlier.find(
            (value) => !question.choices.some((each) => each.value === value)
          )
          return (
            <QuestionnaireItem
              key={question.name}
              name={question.name}
              required={question.required}
              multiple={question.multiple}
              disabled={!isShown(question, answers)}
              className={cn(moved && "data-active:step-in")}
            >
              <QuestionnaireTitle>{question.prompt}</QuestionnaireTitle>
              {question.description || question.multiple ? (
                <QuestionnaireDescription>
                  {question.description ?? "Pick all that apply."}
                </QuestionnaireDescription>
              ) : null}
              <QuestionnaireChoices>
                {question.choices.map((choice) => (
                  <QuestionnaireChoice
                    key={choice.value}
                    value={choice.value}
                    defaultChecked={earlier.includes(choice.value)}
                  >
                    {choice.label}
                    {choice.description ? (
                      <QuestionnaireChoiceDescription>
                        {choice.description}
                      </QuestionnaireChoiceDescription>
                    ) : null}
                  </QuestionnaireChoice>
                ))}
                {question.allowOther ? (
                  <QuestionnaireInput
                    aria-label={
                      question.choices.length > 0
                        ? "Another answer"
                        : question.prompt
                    }
                    placeholder={
                      question.choices.length > 0
                        ? "Something else…"
                        : "Type your answer…"
                    }
                    maxLength={MAX_ANSWER}
                    defaultValue={typed}
                  />
                ) : null}
              </QuestionnaireChoices>
              <QuestionnaireError />
            </QuestionnaireItem>
          )
        })}

        <QuestionnaireActions>
          {keys > 0 ? (
            <span
              aria-hidden="true"
              className="me-auto flex items-center gap-1.5 px-1 text-[12.5px] text-ink-3 max-sm:hidden"
            >
              Press <Kbd>A</Kbd>
              {keys > 1 ? (
                <>
                  –<Kbd>{LETTERS[keys - 1]}</Kbd>
                </>
              ) : null}{" "}
              to answer
            </span>
          ) : null}
          <QuestionnairePrevious>
            <ChevronLeftIcon data-icon="inline-start" />
            Back
          </QuestionnairePrevious>
          <QuestionnaireSkip />
          <QuestionnaireNext />
          <QuestionnaireSubmit>Send answers</QuestionnaireSubmit>
        </QuestionnaireActions>
      </Questionnaire>
    </section>
  )
}

/**
 * The answers in the form now: each shown question's picks and typed words.
 * A skipped question, or one not shown, has no controls with its name.
 */
function read(form: HTMLFormElement, questions: readonly Question[]) {
  const data = new FormData(form)
  return Object.fromEntries(
    questions.flatMap((question) => {
      const values = data
        .getAll(question.name)
        .flatMap((value) =>
          typeof value === "string" && value.trim() !== "" ? [value.trim()] : []
        )
      return values.length > 0 ? [[question.name, values]] : []
    })
  ) satisfies Answers
}

// Answers typed so far live in this browser only, until they are sent. Any
// storage error (private mode, blocked) just means no resume.

function load(key: string): Progress | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null")
    return isProgress(value) ? value : null
  } catch {
    return null
  }
}

function store(key: string, progress: Progress) {
  try {
    localStorage.setItem(key, JSON.stringify(progress))
  } catch {
    // No resume, nothing else lost.
  }
}

function forget(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // Nothing to clean up.
  }
}

function isProgress(value: unknown): value is Progress {
  if (typeof value !== "object" || value === null) return false
  if (!("item" in value) || typeof value.item !== "string") return false
  if (!("answers" in value)) return false
  const { answers } = value
  return (
    typeof answers === "object" &&
    answers !== null &&
    Object.values(answers).every(
      (each) =>
        Array.isArray(each) && each.every((part) => typeof part === "string")
    )
  )
}
