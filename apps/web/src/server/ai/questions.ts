import { z } from "../zod"

// The AI's questionnaire (spec §2 AI design: askQuestions). The model writes
// a short set of questions; the browser shows them as the shadcn
// Questionnaire and sends the answers back. Both sides are checked here:
// the set when the model calls the tool, the answers against that set when
// the user sends them.

/** The longest answer a user may type. */
export const MAX_ANSWER = 500

const choice = z.object({
  value: z.string().min(1).max(60).describe("A short id for this answer."),
  label: z.string().min(1).max(120).describe("The answer, in plain words."),
  description: z
    .string()
    .max(200)
    .optional()
    .describe("One short line more, only if the label needs it."),
})

const question = z.object({
  name: z
    .string()
    .regex(/^[\w.-]{1,60}$/)
    .describe("A short id for the question, like term or signer."),
  prompt: z.string().min(1).max(200).describe("The question, in plain words."),
  description: z
    .string()
    .max(300)
    .optional()
    .describe("One short line of help, only if needed."),
  required: z.boolean().describe("False when the user may skip it."),
  choices: z
    .array(choice)
    .max(8)
    .describe("Up to 8 likely answers. Empty for a question only typed."),
  allowOther: z.boolean().describe("Let the user type another answer."),
  multiple: z.boolean().describe("Several choices may be picked."),
  showIf: z
    .object({
      question: z.string().describe("An earlier question's name."),
      answers: z
        .array(z.string())
        .min(1)
        .describe("Its choice values that make this question apply."),
    })
    .optional()
    .describe("Ask only when an earlier question got one of these answers."),
})

export type Question = z.input<typeof question>

export const questionSet = z
  .object({
    title: z
      .string()
      .min(1)
      .max(40)
      .describe("A name for the set in 1 to 3 words, like Key terms."),
    questions: z.array(question).min(1).max(5),
  })
  .superRefine(({ questions }, ctx) => {
    const seen = new Map<string, Question>()
    questions.forEach((each, index) => {
      const at = (...path: (string | number)[]) => ["questions", index, ...path]
      if (seen.has(each.name))
        ctx.addIssue({
          code: "custom",
          path: at("name"),
          message: `The name ${each.name} is used twice.`,
        })
      const values = each.choices.map((option) => option.value)
      const repeated = values.find((value, i) => values.indexOf(value) !== i)
      if (repeated !== undefined)
        ctx.addIssue({
          code: "custom",
          path: at("choices"),
          message: `The choice ${repeated} is given twice.`,
        })
      if (each.choices.length === 0 && !each.allowOther)
        ctx.addIssue({
          code: "custom",
          path: at("choices"),
          message: "A question needs choices or allowOther.",
        })
      if (each.showIf) {
        const parent = seen.get(each.showIf.question)
        if (!parent)
          ctx.addIssue({
            code: "custom",
            path: at("showIf", "question"),
            message: "showIf must name an earlier question.",
          })
        const unknown = each.showIf.answers.filter(
          (value) => !parent?.choices.some((option) => option.value === value)
        )
        if (parent && unknown.length > 0)
          ctx.addIssue({
            code: "custom",
            path: at("showIf", "answers"),
            message: `${each.showIf.question} has no choice ${unknown.join(", ")}.`,
          })
      }
      seen.set(each.name, each)
    })
  })

/**
 * Each question's answers: choice values, or the user's own words. A
 * skipped question (or one not shown) is left out.
 */
export const answersShape = z.object({
  answers: z.record(
    z.string().max(60),
    z.array(z.string().max(MAX_ANSWER)).max(9)
  ),
})

export type Answers = z.infer<typeof answersShape>["answers"]

/** Whether a question applies, given the answers so far. */
export function isShown(
  question: Pick<Question, "showIf">,
  answers: Readonly<Record<string, readonly string[]>>
): boolean {
  const condition = question.showIf
  if (!condition) return true
  return (answers[condition.question] ?? []).some((value) =>
    condition.answers.includes(value)
  )
}

/** The answers to one question set, as the user may send them. */
export function answersFor(questions: readonly Question[]) {
  return z
    .object({
      answers: z.strictObject(
        Object.fromEntries(
          questions.map((each) => [
            each.name,
            z
              .array(
                each.allowOther
                  ? z.string().trim().min(1).max(MAX_ANSWER)
                  : z.enum(each.choices.map((option) => option.value))
              )
              .min(1)
              .max(each.multiple ? each.choices.length + 1 : 1)
              .optional(),
          ])
        )
      ),
    })
    .superRefine(({ answers }, ctx) => {
      const given: Answers = Object.fromEntries(
        Object.entries(answers).flatMap(([name, values]) =>
          values ? [[name, values]] : []
        )
      )
      for (const each of questions) {
        const shown = isShown(each, given)
        const answered = given[each.name] !== undefined
        if (shown && each.required && !answered)
          ctx.addIssue({
            code: "custom",
            path: ["answers", each.name],
            message: "Answer this question.",
          })
        if (!shown && answered)
          ctx.addIssue({
            code: "custom",
            path: ["answers", each.name],
            message: "This question didn't apply.",
          })
      }
    })
}
