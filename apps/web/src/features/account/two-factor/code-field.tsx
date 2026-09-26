import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp"
import { REGEXP_ONLY_DIGITS, REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp"

import {
  Control,
  type Labels,
  useControl,
} from "@/features/field-editor/fields/control"

// The code boxes of two-factor sign-in (T23b): shadcn's InputOTP, for the
// authenticator app's 6 digits or a 10-character backup code. The whole
// code can be pasted, and the phone's keyboard offers a code it received.
// https://ui.shadcn.com/docs/components/base/input-otp

/** Which code: from the authenticator app, or a saved backup code. */
export type CodeKind = "app" | "backup"

const shapes = {
  app: { length: 6, pattern: REGEXP_ONLY_DIGITS, inputMode: "numeric" },
  backup: {
    length: 10,
    pattern: REGEXP_ONLY_DIGITS_AND_CHARS,
    inputMode: "text",
  },
} as const

export function codeLength(kind: CodeKind) {
  return shapes[kind].length
}

/**
 * The code as Better Auth takes it. Backup codes are shown as "Ab3dE-fG7hJ"
 * (and saved so); the boxes hold the 10 characters without the dash.
 */
export function codeFor(kind: CodeKind, value: string) {
  return kind === "backup" ? `${value.slice(0, 5)}-${value.slice(5)}` : value
}

/** Keeps the letters and digits of a pasted code ("Ab3dE-fG7hJ", "123 456"). */
function lettersAndDigits(pasted: string) {
  return pasted.replaceAll(/[^a-zA-Z0-9]/g, "")
}

export function CodeField({
  kind,
  onComplete,
  autoFocus = false,
  ...labels
}: Labels & {
  kind: CodeKind
  /** All boxes are filled: the form can send it at once. */
  onComplete?: () => void
  autoFocus?: boolean
}) {
  const { field, invalid, props } = useControl()
  const shape = shapes[kind]
  const half = shape.length / 2
  const slots = (from: number) =>
    Array.from({ length: half }, (_, index) => (
      <InputOTPSlot
        key={from + index}
        index={from + index}
        aria-invalid={invalid}
        className={kind === "app" ? "size-10" : undefined}
      />
    ))

  return (
    <Control {...labels}>
      <InputOTP
        id={props.id}
        name={props.name}
        value={props.value}
        onChange={field.handleChange}
        onBlur={props.onBlur}
        onComplete={onComplete}
        aria-invalid={invalid}
        maxLength={shape.length}
        pattern={shape.pattern}
        pasteTransformer={lettersAndDigits}
        inputMode={shape.inputMode}
        autoComplete={kind === "app" ? "one-time-code" : "off"}
        autoCapitalize="off"
        autoCorrect="off"
        // The code step and the setup step have nothing else to fill in.
        // oxlint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
      >
        <InputOTPGroup>{slots(0)}</InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>{slots(half)}</InputOTPGroup>
      </InputOTP>
    </Control>
  )
}
