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
import { useRef, useState, type RefObject } from "react"

// The reply box (spec §1: the reply box at the bottom, the demo note under
// it). Enter sends, Shift+Enter starts a new line; while Parley answers, the
// button stops it. The start page's box is bigger and says what it does:
// "Start drafting" (brand.md canvas, Main).

export const MAX_MESSAGE = 4000

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
  const start = variant === "start"
  const ready = text.trim() !== "" && !busy
  const send = () => {
    // "Start drafting" with nothing typed shows where to type.
    if (text.trim() === "") input.current?.focus()
    if (!ready) return
    onSend(text.trim())
    setText("")
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
          "bg-card",
          start
            ? "rounded-[22px] shadow-[0_1px_2px_rgba(27,26,23,0.04),0_14px_36px_-18px_rgba(27,26,23,0.2)]"
            : "rounded-[20px] shadow-[0_1px_2px_rgba(27,26,23,0.04),0_8px_24px_-14px_rgba(27,26,23,0.14)]"
        )}
      >
        <InputGroupTextarea
          ref={input}
          aria-label={label}
          value={text}
          maxLength={MAX_MESSAGE}
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
              <span className="flex items-center gap-1.5 text-[12.5px] font-normal text-muted-foreground">
                <Kbd>Enter</Kbd>
                to start
              </span>
              <InputGroupButton
                type="submit"
                variant="default"
                disabled={busy}
                className="h-10 rounded-full pr-3.5 pl-4.5 text-[14.5px]"
              >
                Start drafting
                {busy ? (
                  <Spinner data-icon="inline-end" aria-label="Starting" />
                ) : (
                  <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
                )}
              </InputGroupButton>
            </>
          ) : busy && onStop ? (
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
        </InputGroupAddon>
      </InputGroup>
    </form>
  )
}
