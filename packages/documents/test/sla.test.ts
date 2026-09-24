import { describe, expect, it } from "vite-plus/test"

import { applyFieldChanges } from "../src/changes.ts"
import { initialValues, type DraftValues } from "../src/define.ts"
import { sla } from "../src/definitions/sla.ts"
import { render } from "../src/render.ts"

const issues = (values: unknown) =>
  sla.draftSchema.safeParse(values).error?.issues.map((issue) => ({
    path: issue.path,
    message: issue.message,
  })) ?? []

const headings = (values: DraftValues<typeof sla.fields>) =>
  render(sla, values).coverPage.sections.map((section) => section.heading)

const uptime = (target: number) =>
  ({
    option: "uptime",
    value: { target, downtime: { option: "none" } },
  }) as const
const response = {
  option: "response",
  value: {
    time: { amount: 30, unit: "minutes" },
    credit: 2,
    channel: "support@northwind.test",
  },
} as const

describe("the SLA's cover page", () => {
  it("won't let a company sign both sides", () => {
    expect(
      issues({
        provider: { company: "Northwind" },
        customer: { company: "NORTHWIND" },
      })
    ).toEqual([
      {
        path: ["customer"],
        message: "The provider and the customer must be different companies.",
      },
    ])
  })

  it("needs at least one target to finish, but not while drafting", () => {
    const { targets } = sla.fields

    expect(targets.schema.safeParse({ selected: [] }).success).toBe(false)
    expect(targets.schema.safeParse({ selected: [response] }).success).toBe(
      true
    )
    expect(issues({ targets: { selected: [] } })).toEqual([])
  })

  it("needs each picked target's details to finish", () => {
    const { targets } = sla.fields
    const unfinished = [
      { option: "uptime", value: { target: 99.9 } },
      { option: "response", value: { time: { amount: 1, unit: "days" } } },
    ]

    for (const pick of unfinished)
      expect(targets.schema.safeParse({ selected: [pick] }).success).toBe(false)
  })

  it("lets a draft switch from one target to the other in any order", () => {
    const start = { targets: { selected: [uptime(99.9)] } }
    const { rejected } = applyFieldChanges(sla, start, [
      { key: "targets", value: { selected: [] } },
      { key: "targets", value: { selected: [response] } },
    ])

    expect(rejected).toEqual([])
  })

  it("takes Common Paper's strongest uptime, 99.999%", () => {
    expect(issues({ targets: { selected: [uptime(99.999)] } })).toEqual([])
    expect(issues({ targets: { selected: [uptime(99.9999)] } })).toHaveLength(1)
  })

  it("shows the uptime credit table only with an uptime target", () => {
    expect(headings({})).toEqual(["Agreement", "SLA"])
    expect(headings({ targets: { selected: [{ option: "uptime" }] } })).toEqual(
      ["Agreement", "SLA", "Uptime Credit"]
    )
  })

  it("seeds nothing: Common Paper pre-marks no option", () => {
    expect(initialValues(sla, { today: "2026-09-24" })).toEqual({})
  })
})
