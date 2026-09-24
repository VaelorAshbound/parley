import { describe, expect, it } from "vite-plus/test"

import { initialValues } from "../src/define.ts"
import { aiAddendum } from "../src/definitions/ai-addendum.ts"
import { examples } from "./examples.ts"

const issues = (values: unknown) =>
  aiAddendum.draftSchema.safeParse(values).error?.issues.map((issue) => ({
    path: issue.path,
    message: issue.message,
  })) ?? []

/** The issues a finished page gets: the example with some rows changed. */
const finishedIssues = (changes: object) =>
  aiAddendum.schema
    .safeParse({ ...examples["ai-addendum"], ...changes })
    .error?.issues.map((issue) => ({
      path: issue.path,
      message: issue.message,
    })) ?? []

describe("the AI Addendum's cover page", () => {
  it("won't let a company sign both sides", () => {
    expect(
      issues({
        provider: { company: "Northwind" },
        customer: { company: "northwind" },
      })
    ).toEqual([
      {
        path: ["customer"],
        message: "The provider and the customer must be different companies.",
      },
    ])
  })

  it("won't train on None and something else", () => {
    expect(
      issues({
        trainingData: { selected: [{ option: "none" }, { option: "input" }] },
      })
    ).toEqual([
      {
        path: ["trainingData", "selected"],
        message: `"None" can't be picked with anything else.`,
      },
    ])
  })

  it("takes one version of each side's covered claims", () => {
    const custom = (option: "providerCustom" | "customerCustom") => ({
      option,
      value: "that the Output infringes a patent.",
    })

    expect(
      issues({
        coveredClaims: {
          selected: [
            { option: "provider" },
            custom("providerCustom"),
            { option: "customer" },
            custom("customerCustom"),
          ],
        },
      })
    ).toEqual([
      {
        path: ["coveredClaims"],
        message: "Pick one version of the Provider Covered Claims.",
      },
      {
        path: ["coveredClaims"],
        message: "Pick one version of the Customer Covered Claims.",
      },
    ])
    expect(
      issues({
        coveredClaims: {
          selected: [{ option: "provider" }, custom("customerCustom")],
        },
      })
    ).toEqual([])
  })

  it("needs the training data and purposes to agree on a finished page", () => {
    const noPurpose = { trainingPurposes: { option: "none" } }
    const noData = { trainingData: { selected: [{ option: "none" }] } }
    expect(issues({ ...examples["ai-addendum"], ...noPurpose })).toEqual([])
    expect(finishedIssues(noPurpose)).toEqual([
      {
        path: ["trainingPurposes"],
        message:
          "Training data is picked, so pick a training purpose, or set Training data to None.",
      },
    ])
    expect(finishedIssues(noData)).toEqual([
      {
        path: ["trainingData"],
        message:
          "A training purpose is picked, so pick the training data, or set Training purposes to None.",
      },
    ])
    expect(finishedIssues({ ...noData, ...noPurpose })).toEqual([])
    expect(
      finishedIssues({ trainingData: { selected: [], other: "Logs" } })
    ).toEqual([])
  })

  it("seeds nothing: Common Paper pre-marks no option", () => {
    expect(initialValues(aiAddendum, { today: "2026-09-24" })).toEqual({})
  })
})
