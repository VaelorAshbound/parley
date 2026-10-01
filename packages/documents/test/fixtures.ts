import { defineDocument } from "../src/define.ts"
import { field } from "../src/fields.ts"
import type { StandardTerms } from "../src/parse/schema.ts"

// A small template in the parsed shape, so each test reads on its own.
export const template: StandardTerms = {
  type: "standardTerms",
  title: "Standard Terms",
  children: [
    {
      type: "clause",
      id: "1",
      content: [
        { type: "text", value: "For the " },
        {
          type: "linkedTerm",
          kind: "coverpage",
          term: "Purpose",
          text: "Purpose",
        },
        { type: "text", value: ", under the laws of " },
        {
          type: "linkedTerm",
          kind: "coverpage",
          term: "Governing Law",
          text: "Governing Law",
        },
        { type: "text", value: ", notices go to each " },
        {
          type: "linkedTerm",
          kind: "coverpage",
          term: "Notice Address",
          text: "Notice Address",
        },
        { type: "text", value: "." },
      ],
      children: [],
    },
  ],
}

const duration = field.duration({ label: "Term length", help: "How long." })

export function nda() {
  return defineDocument({
    id: "test-nda",
    version: 1,
    name: "Test NDA",
    template,
    fields: {
      purpose: field.longText({
        label: "Purpose",
        help: "What the information may be used for.",
        default: "Evaluating a business relationship.",
      }),
      effectiveDate: field.date({
        label: "Effective date",
        help: "When it starts.",
        defaultToday: true,
      }),
      term: field.choice({
        label: "MNDA term",
        help: "How long the MNDA lasts.",
        options: {
          fixed: {
            label: "Expires {value} from Effective Date.",
            with: duration,
          },
          untilTerminated: { label: "Continues until terminated." },
        },
        default: { option: "fixed", value: { amount: 1, unit: "years" } },
      }),
      governingLaw: field.jurisdiction({
        label: "Governing law",
        help: "Whose laws apply.",
      }),
      modifications: field.longText({
        label: "Modifications",
        help: "Changes to the standard terms.",
        optional: true,
      }),
      party1: field.party({ label: "Party 1", help: "The first party." }),
      party2: field.party({ label: "Party 2", help: "The second party." }),
    },
    linkedTerms: {
      Purpose: "purpose",
      "Governing Law": "governingLaw.state",
      "Notice Address": ["party1.email", "party2.email"],
    },
    coverPage: {
      source: "parley",
      title: "Test NDA",
      intro: [],
      sections: [
        { heading: "Purpose", field: "purpose" },
        { heading: "Effective Date", field: "effectiveDate" },
        { heading: "MNDA Term", field: "term" },
        {
          heading: "Governing Law & Jurisdiction",
          lines: [
            { label: "Governing Law", field: "governingLaw.state" },
            { label: "Jurisdiction", field: "governingLaw.courtLocation" },
          ],
        },
        { heading: "MNDA Modifications", field: "modifications" },
      ],
      closing: [],
      signatures: ["party1", "party2"],
      footer: [],
    },
    rules: (values, issue) => {
      if (
        values.party1?.company !== undefined &&
        values.party1.company === values.party2?.company
      )
        issue("party2", "The two parties must be different companies.")
    },
  })
}

export const complete = {
  purpose: "Evaluating a business relationship.",
  effectiveDate: "2026-09-24",
  term: { option: "fixed", value: { amount: 2, unit: "years" } },
  governingLaw: { state: "DE", courtLocation: "New Castle" },
  party1: {
    company: "Acme",
    name: "Ana",
    title: "CEO",
    email: "ana@acme.test",
  },
  party2: { company: "Bolt", name: "Bo", title: "CTO", address: "1 Main St" },
}

/** A document with a list and a group, for tables and checklists. */
export function annexDocument() {
  return defineDocument({
    id: "annex",
    version: 1,
    name: "Annex",
    template,
    fields: {
      subprocessors: field.list({
        label: "Subprocessors",
        help: "Who else handles data.",
        item: {
          name: field.text({ label: "Name", help: "The company." }),
          country: field.text({ label: "Country", help: "Where." }),
        },
      }),
      measures: field.group({
        label: "Security measures",
        help: "How data is kept safe.",
        parts: {
          encryption: field.longText({
            label: "Encryption",
            help: "How.",
            optional: true,
          }),
          access: field.longText({
            label: "Access control",
            help: "Who.",
            optional: true,
          }),
        },
      }),
    },
    linkedTerms: {},
    coverPage: {
      source: "parley",
      title: "Annex",
      intro: [],
      sections: [
        { heading: "Subprocessors", field: "subprocessors" },
        { heading: "Security Measures", field: "measures" },
      ],
      closing: [],
      signatures: [],
      footer: [],
    },
  })
}
