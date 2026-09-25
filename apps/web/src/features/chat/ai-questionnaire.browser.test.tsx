import { beforeEach, describe, expect, test, vi } from "vite-plus/test"
import { userEvent } from "vite-plus/test/browser"
import { render } from "vitest-browser-react"

import type { Answers } from "@/server/ai/questions"

import { AiQuestionnaire, type QuestionSet } from "./ai-questionnaire"

// The AI's questionnaire in real Chromium (spec §6: keyboard shortcuts,
// Other, skip, resume after reload).

const set: QuestionSet = {
  title: "Key terms",
  questions: [
    {
      name: "term",
      prompt: "How long should the NDA last?",
      required: true,
      choices: [
        { value: "1y", label: "1 year" },
        { value: "2y", label: "2 years", description: "Room to evaluate." },
      ],
      multiple: false,
    },
    {
      name: "hasSigner",
      prompt: "Do you know who signs for Northwind?",
      required: true,
      choices: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "Not yet" },
      ],
      multiple: false,
    },
    {
      name: "signer",
      prompt: "Who signs for Northwind?",
      required: true,
      choices: [],
      multiple: false,
      showIf: { question: "hasSigner", answers: ["yes"] },
    },
    {
      name: "law",
      prompt: "Which state's law applies?",
      required: false,
      choices: [{ value: "DE", label: "Delaware" }],
      multiple: false,
    },
  ],
}

beforeEach(() => localStorage.clear())

/** Presses an answer's letter and waits for the next question to show. */
async function pick(
  screen: Awaited<ReturnType<typeof show>>["screen"],
  letter: string,
  next: string
) {
  await userEvent.keyboard(letter)
  await expect.element(screen.getByRole("group", { name: next })).toBeVisible()
}

async function show(toolCallId = "call-1") {
  const onAnswer = vi.fn<(answers: Answers) => void>()
  const screen = await render(
    <AiQuestionnaire toolCallId={toolCallId} set={set} onAnswer={onAnswer} />
  )
  return { screen, onAnswer }
}

describe("the AI's questionnaire", () => {
  test("shows one question at a time, with its set and progress", async () => {
    const { screen } = await show()

    await expect
      .element(screen.getByRole("group", { name: set.questions[0]?.prompt }))
      .toBeVisible()
    await expect.element(screen.getByText("Key terms")).toBeVisible()
    await expect
      .element(screen.getByRole("progressbar", { name: "Key terms progress" }))
      .toHaveTextContent("1 of 3")
  })

  test("always offers another answer beside the choices", async () => {
    const { screen, onAnswer } = await show()

    await userEvent.type(
      screen.getByRole("textbox", { name: "Another answer" }),
      "3 years{Enter}"
    )
    await userEvent.keyboard("b")
    await screen.getByRole("button", { name: "Skip" }).click()

    await expect
      .poll(() => onAnswer.mock.calls[0]?.[0])
      .toEqual({ term: ["3 years"], hasSigner: ["no"] })
  })

  test("picks an answer by its letter and moves on by itself", async () => {
    const { screen } = await show()

    await userEvent.keyboard("b")

    await expect
      .element(screen.getByRole("group", { name: set.questions[1]?.prompt }))
      .toBeVisible()
  })

  test("asks a follow-up only after the answer it depends on", async () => {
    const { screen } = await show()
    await userEvent.keyboard("b")
    await expect
      .element(screen.getByRole("progressbar", { name: "Key terms progress" }))
      .toHaveTextContent("2 of 3")

    await userEvent.keyboard("a")

    await expect
      .element(screen.getByRole("group", { name: "Who signs for Northwind?" }))
      .toBeVisible()
    await expect
      .element(screen.getByRole("progressbar", { name: "Key terms progress" }))
      .toHaveTextContent("3 of 4")
  })

  test("sends picks, typed answers, and leaves out a skipped question", async () => {
    const { screen, onAnswer } = await show()
    await pick(screen, "b", "Do you know who signs for Northwind?")
    await pick(screen, "a", "Who signs for Northwind?")
    await userEvent.type(
      screen.getByRole("textbox", { name: "Who signs for Northwind?" }),
      "Bo Chen{Enter}"
    )
    await expect
      .element(screen.getByRole("group", { name: set.questions[3]?.prompt }))
      .toBeVisible()

    await screen.getByRole("button", { name: "Skip" }).click()

    await expect
      .poll(() => onAnswer.mock.calls[0]?.[0])
      .toEqual({ term: ["2y"], hasSigner: ["yes"], signer: ["Bo Chen"] })
  })

  test("takes another answer typed in the Other row", async () => {
    const { screen, onAnswer } = await show()
    await pick(screen, "a", "Do you know who signs for Northwind?")
    await pick(screen, "b", "Which state's law applies?")

    await userEvent.type(
      screen.getByRole("textbox", { name: "Another answer" }),
      "Texas"
    )
    await screen.getByRole("button", { name: "Send answers" }).click()

    await expect
      .poll(() => onAnswer.mock.calls[0]?.[0])
      .toEqual({ term: ["1y"], hasSigner: ["no"], law: ["Texas"] })
  })

  test("won't move on from a required question without an answer", async () => {
    const { screen } = await show()

    await screen.getByRole("button", { name: "Next" }).click()

    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("Choose an answer to continue.")
  })

  test("picks up where it was after a reload", async () => {
    const first = await show("call-7")
    await userEvent.keyboard("b")
    await expect
      .element(
        first.screen.getByRole("group", { name: set.questions[1]?.prompt })
      )
      .toBeVisible()
    await first.screen.unmount()

    const { screen, onAnswer } = await show("call-7")
    await expect
      .element(screen.getByRole("group", { name: set.questions[1]?.prompt }))
      .toBeVisible()
    await userEvent.keyboard("b")
    await screen.getByRole("button", { name: "Skip" }).click()

    await expect
      .poll(() => onAnswer.mock.calls[0]?.[0])
      .toEqual({ term: ["2y"], hasSigner: ["no"] })
    // Sent: nothing is left to resume.
    expect(localStorage.getItem("parley:questions:call-7")).toBeNull()
  })
})
