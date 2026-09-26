import catalog from "../../generated/catalog.ts"
import cover from "../../generated/mutual-nda-coverpage.ts"
import template from "../../generated/mutual-nda.ts"
import { defineDocument } from "../define.ts"
import { field } from "../fields.ts"
import type { CoverBlock } from "../parse/schema.ts"

// The Mutual NDA uses Common Paper's own cover page (spec §1). Its headings,
// hints and choice wording are copied below; its paragraphs come straight
// from the parsed official page. test/definitions.test.ts checks both.

const paragraphs = (blocks: CoverBlock[]) =>
  blocks.flatMap((block) => (block.type === "paragraph" ? [block.content] : []))
const firstSection = cover.children.findIndex(
  (block) => block.type === "heading" && block.depth === 3
)
const table = cover.children.findIndex((block) => block.type === "table")

export const mutualNda = defineDocument({
  id: "mutual-nda",
  version: 1,
  name: catalog["mutual-nda"].name,
  template,
  fields: {
    purpose: field.longText({
      label: "Purpose",
      help: "How Confidential Information may be used.",
      default:
        "Evaluating whether to enter into a business relationship with the other party.",
    }),
    effectiveDate: field.date({
      label: "Effective date",
      help: "The date the MNDA starts.",
      defaultToday: true,
    }),
    mndaTerm: field.choice({
      label: "MNDA term",
      help: "The length of this MNDA.",
      options: {
        expires: {
          label: "Expires {value} from Effective Date.",
          with: field.duration({
            label: "MNDA length",
            units: ["days", "weeks", "months", "years"],
            help: "How long until the MNDA expires.",
          }),
        },
        untilTerminated: {
          label:
            "Continues until terminated in accordance with the terms of the MNDA.",
        },
      },
      default: { option: "expires", value: { amount: 1, unit: "years" } },
    }),
    confidentialityTerm: field.choice({
      label: "Term of confidentiality",
      help: "How long Confidential Information is protected.",
      options: {
        fixed: {
          label:
            "{value} from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.",
          with: field.duration({
            label: "Confidentiality length",
            units: ["days", "weeks", "months", "years"],
            help: "How long Confidential Information stays protected.",
          }),
        },
        perpetual: { label: "In perpetuity." },
      },
      default: { option: "fixed", value: { amount: 1, unit: "years" } },
    }),
    // The NDA's terms say "the laws of the State of", so a US state only.
    governingLaw: field.jurisdiction({
      label: "Governing law & jurisdiction",
      help: "Which state's laws govern the MNDA, and where its courts sit.",
      usOnly: true,
    }),
    modifications: field.longText({
      label: "MNDA modifications",
      help: "List any modifications to the MNDA.",
      optional: true,
    }),
    party1: field.party({
      label: "Party 1",
      help: "The first party signing the MNDA.",
    }),
    party2: field.party({
      label: "Party 2",
      help: "The second party signing the MNDA.",
    }),
  },
  linkedTerms: {
    Purpose: "purpose",
    "Effective Date": "effectiveDate",
    "MNDA Term": "mndaTerm",
    "Term of Confidentiality": "confidentialityTerm",
    "Governing Law": "governingLaw.state",
    Jurisdiction: "governingLaw.courtLocation",
  },
  coverPage: {
    source: "official",
    title: "Mutual Non-Disclosure Agreement",
    subtitle: "USING THIS MUTUAL NON-DISCLOSURE AGREEMENT",
    intro: paragraphs(cover.children.slice(0, firstSection)),
    sections: [
      {
        heading: "Purpose",
        hint: "How Confidential Information may be used",
        field: "purpose",
      },
      { heading: "Effective Date", field: "effectiveDate" },
      {
        heading: "MNDA Term",
        hint: "The length of this MNDA",
        field: "mndaTerm",
      },
      {
        heading: "Term of Confidentiality",
        hint: "How long Confidential Information is protected",
        field: "confidentialityTerm",
      },
      {
        heading: "Governing Law & Jurisdiction",
        lines: [
          { label: "Governing Law", field: "governingLaw.state" },
          { label: "Jurisdiction", field: "governingLaw.courtLocation" },
        ],
      },
      { heading: "MNDA Modifications", field: "modifications" },
    ],
    // "By signing this Cover Page…", the paragraph just above the table.
    closing: paragraphs(cover.children.slice(0, table)).slice(-1),
    signatures: ["party1", "party2"],
    footer: paragraphs(cover.children.slice(table + 1)),
  },
  rules: (values, issue) => {
    const company = (name?: string) => name?.trim().toLowerCase()
    const first = company(values.party1?.company)
    if (first !== undefined && first === company(values.party2?.company))
      issue("party2", "The two parties must be different companies.")
  },
})
