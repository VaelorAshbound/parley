import { describe, expect, test } from "vite-plus/test"

import { answersFor, isShown, questionSet, type Question } from "./questions"

const term: Question = {
  name: "term",
  prompt: "How long should the NDA last?",
  required: true,
  choices: [
    { value: "1y", label: "1 year" },
    { value: "2y", label: "2 years" },
  ],
  multiple: false,
}
const law: Question = {
  name: "law",
  prompt: "Which state's law applies?",
  required: true,
  choices: [{ value: "DE", label: "Delaware" }],
  multiple: false,
}
const hasSigner: Question = {
  name: "hasSigner",
  prompt: "Do you know who signs for Northwind?",
  required: true,
  choices: [
    { value: "yes", label: "Yes" },
    { value: "no", label: "Not yet" },
  ],
  multiple: false,
}
const signer: Question = {
  name: "signer",
  prompt: "Who signs for Northwind?",
  required: true,
  choices: [],
  multiple: false,
  showIf: { question: "hasSigner", answers: ["yes"] },
}
const extras: Question = {
  name: "extras",
  prompt: "Anything else to cover?",
  required: false,
  choices: [
    { value: "nonSolicit", label: "No hiring each other's staff" },
    { value: "return", label: "Return documents at the end" },
  ],
  multiple: true,
}

describe("a question set from the model", () => {
  test("takes a short set of related questions", () => {
    const result = questionSet.safeParse({
      title: "Key terms",
      questions: [term, law, hasSigner, signer, extras],
    })

    expect(result.success).toBe(true)
  })

  test("takes null for a missing condition, as models fill every key", () => {
    const result = questionSet.safeParse({
      title: "Key terms",
      questions: [{ ...term, showIf: null, description: "" }],
    })

    expect(result.success).toBe(true)
    expect(isShown({ showIf: null }, {})).toBe(true)
  })

  test.for(["constructor", "toString", "__proto__", "hasOwnProperty"])(
    "refuses the name %s, which every object already has",
    (name) => {
      const result = questionSet.safeParse({
        title: "Key terms",
        questions: [{ ...term, name }],
      })

      expect(result.success).toBe(false)
    }
  )

  test("needs unique question names", () => {
    const result = questionSet.safeParse({
      title: "Key terms",
      questions: [term, term],
    })

    expect(result.error?.issues[0]?.message).toMatch(/twice/)
  })

  test("needs unique answer values within a question", () => {
    const repeated = { ...term, choices: [term.choices[0], term.choices[0]] }

    const result = questionSet.safeParse({
      title: "Key terms",
      questions: [repeated],
    })

    expect(result.error?.issues[0]?.message).toMatch(/twice/)
  })

  test("shows a question only after the one it depends on", () => {
    const early = questionSet.safeParse({
      title: "Key terms",
      questions: [signer, hasSigner],
    })
    const unknownAnswer = questionSet.safeParse({
      title: "Key terms",
      questions: [
        hasSigner,
        { ...signer, showIf: { question: "hasSigner", answers: ["maybe"] } },
      ],
    })

    expect(early.error?.issues[0]?.message).toMatch(/earlier question/)
    expect(unknownAnswer.error?.issues[0]?.message).toMatch(/maybe/)
  })

  test("needs a short title for the set", () => {
    const result = questionSet.safeParse({ title: "", questions: [term] })

    expect(result.success).toBe(false)
  })

  test("keeps sets short", () => {
    const many = Array.from({ length: 6 }, (_, index) => ({
      ...term,
      name: `q${index}`,
    }))

    expect(
      questionSet.safeParse({ title: "Key terms", questions: many }).success
    ).toBe(false)
  })
})

describe("the answers to a question set", () => {
  const questions = [term, law, hasSigner, signer, extras]
  const check = (answers: Record<string, string[]>) =>
    answersFor(questions).safeParse({ answers })

  test("take a choice, the user's own words, several picks, or a skip", () => {
    const result = check({
      term: ["2y"],
      law: ["Texas"],
      hasSigner: ["yes"],
      signer: ["Bo Chen"],
      extras: ["nonSolicit", "Keep it short"],
    })

    expect(result.success).toBe(true)
  })

  test("take the user's own words for any question, as Other is always there", () => {
    const result = check({ term: ["3 years"], law: ["DE"], hasSigner: ["no"] })

    expect(result.success).toBe(true)
  })

  test("refuse two answers to a single-answer question", () => {
    const result = check({ term: ["1y", "2y"], law: ["DE"], hasSigner: ["no"] })

    expect(result.success).toBe(false)
  })

  test("refuse a question that isn't in the set", () => {
    const result = check({
      term: ["1y"],
      law: ["DE"],
      hasSigner: ["no"],
      extra: ["x"],
    })

    expect(result.success).toBe(false)
  })

  test("need every required question that was shown", () => {
    const missing = check({ term: ["1y"], hasSigner: ["no"] })
    const shownButMissing = check({
      term: ["1y"],
      law: ["DE"],
      hasSigner: ["yes"],
    })

    expect(missing.error?.issues[0]?.path).toEqual(["answers", "law"])
    expect(shownButMissing.error?.issues[0]?.path).toEqual([
      "answers",
      "signer",
    ])
  })

  test("refuse an answer to a question that wasn't shown", () => {
    const result = check({
      term: ["1y"],
      law: ["DE"],
      hasSigner: ["no"],
      signer: ["Bo Chen"],
    })

    expect(result.error?.issues[0]?.path).toEqual(["answers", "signer"])
  })

  test("refuse very long free text", () => {
    const result = check({
      term: ["1y"],
      law: ["x".repeat(501)],
      hasSigner: ["no"],
    })

    expect(result.success).toBe(false)
  })
})

describe("isShown", () => {
  test("shows a question without a condition", () => {
    expect(isShown(term, {})).toBe(true)
  })

  test("shows a question once its condition's answer is picked", () => {
    expect(isShown(signer, { hasSigner: ["no"] })).toBe(false)
    expect(isShown(signer, { hasSigner: ["yes"] })).toBe(true)
  })
})
