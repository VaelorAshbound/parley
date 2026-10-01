import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { useState } from "react"

import {
  Control,
  type Labels,
  useControl,
} from "@/features/field-editor/fields/control"

/**
 * A password input with a show/hide button, so people can check what they
 * typed on a phone. `autoComplete` tells password managers whether to fill
 * a saved password or offer a new one.
 */
export function PasswordField({
  autoComplete,
  ...labels
}: Labels & { autoComplete: "current-password" | "new-password" }) {
  const { field, props } = useControl()
  const [visible, setVisible] = useState(false)
  return (
    <Control {...labels}>
      <InputGroup>
        <InputGroupInput
          {...props}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          onChange={(event) => field.handleChange(event.target.value)}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            // A toggle: one name, its state in aria-pressed.
            aria-label="Show password"
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </Control>
  )
}
