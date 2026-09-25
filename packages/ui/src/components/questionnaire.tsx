import * as React from "react"
import { Questionnaire as QuestionnairePrimitive } from "@shadcn/react/questionnaire"
import { cn } from "cn"

import { buttonVariants, type Button } from "@workspace/ui/components/button"
import { CheckIcon, PenLineIcon } from "lucide-react"

// The shadcn Questionnaire (base-nova), restyled to Paper & Ink (brand.md:
// the questionnaire card): a serif question, answer rows with their letter
// key on the left and a blue check on the right, a dashed row for another
// answer, and quiet actions.

function Questionnaire({
  className,
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Root>) {
  return (
    <QuestionnairePrimitive.Root
      data-slot="questionnaire"
      className={cn("flex w-full min-w-0 flex-col gap-3.5", className)}
      {...props}
    />
  )
}

function QuestionnaireProgress({
  className,
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Progress>) {
  return (
    <QuestionnairePrimitive.Progress
      data-slot="questionnaire-progress"
      className={cn(
        "min-h-[1lh] w-fit min-w-[14ch] text-[12.5px] text-ink-3 tabular-nums",
        className
      )}
      {...props}
    />
  )
}

function QuestionnaireItem({
  className,
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Item>) {
  return (
    <QuestionnairePrimitive.Item
      data-slot="questionnaire-item"
      className={cn(
        "flex min-w-0 flex-col gap-3.5 border-0 p-0 outline-none",
        className
      )}
      {...props}
    />
  )
}

function QuestionnaireTitle({
  className,
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Title>) {
  return (
    <QuestionnairePrimitive.Title
      data-slot="questionnaire-title"
      className={cn(
        "px-1 font-heading text-[21px] leading-[1.25] font-medium tracking-[-0.01em] text-pretty text-foreground [&:not(:has(~[data-slot=questionnaire-description]))]:mb-3.5",
        className
      )}
      {...props}
    />
  )
}

function QuestionnaireDescription({
  className,
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Description>) {
  return (
    <QuestionnairePrimitive.Description
      data-slot="questionnaire-description"
      className={cn("mt-1 px-1 text-small text-pretty text-ink-2", className)}
      {...props}
    />
  )
}

function QuestionnaireChoices({
  className,
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Choices>) {
  return (
    <QuestionnairePrimitive.Choices
      data-slot="questionnaire-choices"
      className={cn(
        "group/questionnaire-choices flex min-w-0 flex-col gap-1.5",
        className
      )}
      {...props}
    />
  )
}

function QuestionnaireChoice({
  children,
  className,
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Choice>) {
  return (
    <QuestionnairePrimitive.Choice
      data-slot="questionnaire-choice"
      className={cn(
        "group/questionnaire-choice relative flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border bg-card py-2.25 pr-3 pl-2.5 text-start transition-[background-color,border-color,scale] duration-140 ease-(--ease-out) outline-none select-none hover:bg-accent active:scale-[0.97] motion-reduce:active:scale-100",
        "has-[>input:focus-visible]:border-ring has-[>input:focus-visible]:ring-3 has-[>input:focus-visible]:ring-ring/50 data-invalid:border-destructive data-checked:border-blue-border data-checked:bg-blue-tint data-checked:hover:bg-blue-tint",
        "data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <QuestionnairePrimitive.ChoiceInput
        data-slot="questionnaire-choice-input"
        className="absolute inset-0 z-10 size-full cursor-pointer opacity-0"
      />
      {/* The letter key; without shortcuts, a radio or checkbox instead. */}
      <QuestionnairePrimitive.ChoiceShortcut
        data-slot="questionnaire-choice-shortcut"
        className="pointer-events-none grid size-6 shrink-0 place-items-center rounded-[7px] border border-input text-[11.5px] font-semibold text-ink-2 transition-colors duration-140 group-data-checked/questionnaire-choice:border-blue-ink group-data-checked/questionnaire-choice:bg-blue-ink group-data-checked/questionnaire-choice:text-on-blue"
      />
      <span
        aria-hidden="true"
        data-slot="questionnaire-choice-indicator"
        className="pointer-events-none size-4 shrink-0 rounded-[4px] border border-ink-3 group-data-[shortcut]/questionnaire-choice:hidden group-data-[type=radio]/questionnaire-choice:rounded-full group-data-checked/questionnaire-choice:border-blue-ink group-data-checked/questionnaire-choice:bg-blue-ink"
      />
      <QuestionnairePrimitive.ChoiceLabel
        data-slot="questionnaire-choice-label"
        className="flex min-w-0 flex-1 flex-col gap-px text-[14.5px] leading-snug font-medium text-foreground"
      >
        {children}
      </QuestionnairePrimitive.ChoiceLabel>
      <CheckIcon
        aria-hidden="true"
        data-slot="questionnaire-choice-check"
        strokeWidth={2}
        className="check-in hidden size-4.5 shrink-0 text-blue-ink group-data-checked/questionnaire-choice:block"
      />
    </QuestionnairePrimitive.Choice>
  )
}

function QuestionnaireChoiceDescription({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="questionnaire-choice-description"
      className={cn("text-[13px] font-normal text-ink-2", className)}
      {...props}
    />
  )
}

/** Another answer, typed: a dashed row that turns solid once it holds one. */
function QuestionnaireInput({
  className,
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Input>) {
  return (
    <div
      data-slot="questionnaire-input-wrapper"
      className="group/questionnaire-input relative flex min-h-11 w-full min-w-0 items-center gap-3 rounded-xl border border-dashed border-input py-1.5 pr-3 pl-2.5 transition-colors duration-140 has-[input:focus-visible]:border-solid has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50 has-[input[aria-invalid]]:border-destructive has-[input[data-filled]]:border-solid has-[input[data-filled]]:border-blue-border has-[input[data-filled]]:bg-blue-tint"
    >
      <span
        aria-hidden="true"
        className="grid size-6 shrink-0 place-items-center rounded-[7px] border border-input text-ink-2"
      >
        <PenLineIcon className="size-3.5" />
      </span>
      <QuestionnairePrimitive.Input
        data-slot="questionnaire-input"
        className={cn(
          "h-7.5 min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-foreground outline-none placeholder:text-ink-3 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "selection:bg-primary selection:text-primary-foreground",
          className
        )}
        {...props}
      />
    </div>
  )
}

function QuestionnaireError({
  className,
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Error>) {
  return (
    <QuestionnairePrimitive.Error
      data-slot="questionnaire-error"
      className={cn("-mt-1.5 px-1 text-small text-destructive", className)}
      {...props}
    />
  )
}

function QuestionnaireActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="questionnaire-actions"
      className={cn(
        "flex min-h-11 w-full items-center justify-end gap-0.5 sm:min-h-8",
        className
      )}
      {...props}
    />
  )
}

function QuestionnairePrevious({
  children,
  className,
  size = "sm",
  variant = "ghost",
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Previous> &
  Pick<React.ComponentProps<typeof Button>, "size" | "variant">) {
  return (
    <QuestionnairePrimitive.Previous
      data-slot="questionnaire-previous"
      data-size={size}
      data-variant={variant}
      className={cn(
        buttonVariants({ size, variant }),
        "min-h-11 sm:min-h-0",
        className
      )}
      {...props}
    >
      {children ?? "Previous"}
    </QuestionnairePrimitive.Previous>
  )
}

function QuestionnaireSkip({
  children,
  className,
  size = "sm",
  variant = "ghost",
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Skip> &
  Pick<React.ComponentProps<typeof Button>, "size" | "variant">) {
  return (
    <QuestionnairePrimitive.Skip
      data-slot="questionnaire-skip"
      data-size={size}
      data-variant={variant}
      className={cn(
        buttonVariants({ size, variant }),
        "min-h-11 sm:min-h-0",
        className
      )}
      {...props}
    >
      {children ?? "Skip"}
    </QuestionnairePrimitive.Skip>
  )
}

function QuestionnaireNext({
  children,
  className,
  size = "sm",
  variant = "default",
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Next> &
  Pick<React.ComponentProps<typeof Button>, "size" | "variant">) {
  return (
    <QuestionnairePrimitive.Next
      data-slot="questionnaire-next"
      data-size={size}
      data-variant={variant}
      className={cn(
        buttonVariants({ size, variant }),
        "min-h-11 sm:min-h-0",
        className
      )}
      {...props}
    >
      {children ?? "Next"}
    </QuestionnairePrimitive.Next>
  )
}

function QuestionnaireSubmit({
  children,
  className,
  size = "sm",
  variant = "default",
  ...props
}: React.ComponentProps<typeof QuestionnairePrimitive.Submit> &
  Pick<React.ComponentProps<typeof Button>, "size" | "variant">) {
  return (
    <QuestionnairePrimitive.Submit
      data-slot="questionnaire-submit"
      data-size={size}
      data-variant={variant}
      className={cn(
        buttonVariants({ size, variant }),
        "min-h-11 sm:min-h-0",
        className
      )}
      {...props}
    >
      {children ?? "Submit"}
    </QuestionnairePrimitive.Submit>
  )
}

export {
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
}
