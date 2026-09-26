import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@workspace/ui/components/input-group"
import { ArrowUpIcon, SquareIcon } from "lucide-react"
import { useState } from "react"

// The reply box (spec §1: the reply box at the bottom, the demo note under
// it). Enter sends, Shift+Enter starts a new line; while Parley answers, the
// button stops it.

export const MAX_MESSAGE = 4000

export function Composer({
  busy,
  onSend,
  onStop,
  placeholder = "Reply to Parley…",
}: {
  busy: boolean
  onSend: (text: string) => void
  onStop?: () => void
  placeholder?: string
}) {
  const [text, setText] = useState("")
  const ready = text.trim() !== "" && !busy
  const send = () => {
    if (!ready) return
    onSend(text.trim())
    setText("")
  }

  return (
    <form
      aria-label="Reply"
      onSubmit={(event) => {
        event.preventDefault()
        send()
      }}
    >
      <InputGroup className="rounded-[20px] bg-card shadow-[0_1px_2px_rgba(27,26,23,0.04),0_8px_24px_-14px_rgba(27,26,23,0.14)]">
        <InputGroupTextarea
          aria-label="Message"
          value={text}
          maxLength={MAX_MESSAGE}
          placeholder={placeholder}
          rows={1}
          className="field-sizing-content max-h-48 min-h-12 text-[15px]"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) return
            if (event.nativeEvent.isComposing) return
            event.preventDefault()
            send()
          }}
        />
        <InputGroupAddon align="block-end" className="justify-end">
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
        </InputGroupAddon>
      </InputGroup>
    </form>
  )
}
