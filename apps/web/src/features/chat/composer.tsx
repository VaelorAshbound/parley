import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@workspace/ui/components/input-group"
import { Kbd } from "@workspace/ui/components/kbd"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import { ArrowRightIcon, ArrowUpIcon, SquareIcon } from "lucide-react"
import { useEffect, useId, useRef, useState, type RefObject } from "react"

// The reply box (spec §1: the reply box at the bottom, the demo note under
// it). Enter sends, Shift+Enter starts a new line; while Parley answers, the
// button stops it. The start page's box is bigger and says what it does:
// "Start drafting" (brand.md canvas, Main).

export const MAX_MESSAGE = 4000
/** Where the reply box starts counting: 90% of the limit. */
const COUNT_FROM = 3600
/** "3,812", in the reader's own language. */
const count = new Intl.NumberFormat()

export function Composer({
  busy,
  onSend,
  onStop,
  placeholder = "Reply to Parley…",
  label = "Message",
  variant = "reply",
  inputRef,
}: {
  busy: boolean
  onSend: (text: string) => void
  onStop?: () => void
  placeholder?: string
  /** The text box's accessible name. */
  label?: string
  variant?: "reply" | "start"
  /** For a page that moves focus to the box. */
  inputRef?: RefObject<HTMLTextAreaElement | null>
}) {
  const [text, setText] = useState("")
  const ownRef = useRef<HTMLTextAreaElement>(null)
  const input = inputRef ?? ownRef
  // Text typed before the page hydrated shows in the box, but React's copy
  // starts empty, so Start would do nothing (a slow phone; CI found it, T32).
  // Take it once, when React takes over the box.
  useEffect(() => {
    const typed = input.current?.value
    // Syncing from outside React (the DOM), once; at most one more render.
    // oxlint-disable-next-line react/set-state-in-effect
    if (typed) setText(typed)
  }, [input])
  // One send per render (PAR-39): `text` and `busy` are this render's, so
  // two sends in one task (Enter twice, then a click) would all see them
  // unchanged and all go. A ref changes at once; the next render, which has
  // the cleared box or `busy`, opens it again.
  const sent = useRef(false)
  useEffect(() => {
    sent.current = false
  })
  const start = variant === "start"
  // Over the limit, nothing is cut (PAR-37): the box keeps all of it, says
  // it's too long, and won't send until it's shorter. The count shows from
  // near the limit, so a long message doesn't surprise.
  const length = text.trim().length
  const tooLong = length > MAX_MESSAGE
  const counterId = useId()
  const counter =
    length >= COUNT_FROM ? (
      <span
        id={counterId}
        className={cn(
          "mr-auto text-[12.5px] font-normal tabular-nums",
          tooLong ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {tooLong && "Too long to send · "}
        {count.format(length)} / {count.format(MAX_MESSAGE)}
      </span>
    ) : null
  const ready = text.trim() !== "" && !busy && !tooLong
  const send = () => {
    // "Start drafting" with nothing typed shows where to type.
    if (text.trim() === "") input.current?.focus()
    if (!ready || sent.current) return
    sent.current = true
    onSend(text.trim())
    // The start page keeps the deal: a start that works leaves the page,
    // and one that fails can be sent again as typed.
    if (!start) setText("")
  }

  return (
    <form
      aria-label={start ? "Start a draft" : "Reply"}
      onSubmit={(event) => {
        event.preventDefault()
        send()
      }}
    >
      <InputGroup
        className={cn(
          "bg-card shadow-float",
          start ? "rounded-[22px]" : "rounded-[20px]"
        )}
      >
        <InputGroupTextarea
          ref={input}
          aria-label={label}
          value={text}
          aria-invalid={tooLong || undefined}
          aria-describedby={counter ? counterId : undefined}
          placeholder={placeholder}
          rows={start ? 3 : 1}
          className={cn(
            "field-sizing-content max-h-48",
            start
              ? "min-h-21 px-5 pt-4.5 text-[17px] leading-normal"
              : "min-h-12 text-[15px]"
          )}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) return
            if (event.nativeEvent.isComposing) return
            event.preventDefault()
            send()
          }}
        />
        <InputGroupAddon
          align="block-end"
          className={start ? "justify-between pr-3 pb-3 pl-5" : "justify-end"}
        >
          {start ? (
            <>
              {counter ?? (
                <span className="flex items-center gap-1.5 text-[12.5px] font-normal text-muted-foreground pointer-coarse:invisible">
                  <Kbd>Enter</Kbd>
                  to start
                </span>
              )}
              <InputGroupButton
                type="submit"
                variant="default"
                // Focusable while busy: a failed start must not drop focus.
                disabled={busy || tooLong}
                focusableWhenDisabled
                aria-busy={busy}
                className="h-10 rounded-full pr-3.5 pl-4.5 text-[14.5px] data-disabled:opacity-50"
              >
                Start drafting
                {busy ? (
                  <Spinner
                    data-icon="inline-end"
                    role="presentation"
                    aria-hidden="true"
                  />
                ) : (
                  <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
                )}
              </InputGroupButton>
            </>
          ) : (
            <>
              {counter}
              {busy && onStop ? (
                <InputGroupButton
                  type="button"
                  size="icon-sm"
                  variant="secondary"
                  aria-label="Stop"
                  onClick={onStop}
                >
                  <SquareIcon />
                </InputGroupButton>
              ) : (
                <InputGroupButton
                  type="submit"
                  size="icon-sm"
                  variant="default"
                  aria-label="Send"
                  disabled={!ready}
                >
                  <ArrowUpIcon />
                </InputGroupButton>
              )}
            </>
          )}
        </InputGroupAddon>
      </InputGroup>
      {/* Said once when crossing the limit, not at every key. */}
      <span className="sr-only" aria-live="polite">
        {tooLong
          ? `Too long to send. The limit is ${count.format(MAX_MESSAGE)} characters.`
          : ""}
      </span>
    </form>
  )
}
