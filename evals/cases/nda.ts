import type { DraftCase } from "./draft"

// Drafting a whole Mutual NDA by chat (spec §6). The simulated user knows
// only the facts below and answers what the AI asks, in chat or in its
// questionnaire. `expect` is what each field must end up holding.

export const ndaCases: DraftCase[] = [
  {
    name: "robotics roadmap",
    document: "mutual-nda",
    opening:
      "We're Acme Robotics. We're about to share our product roadmap with a supplier, Northwind Labs.",
    facts: `- Party 1: Acme Robotics. Signer: Ana Diaz, CEO, ana@acme.test.
- Party 2: Northwind Labs. Signer: Bo Chen, Head of Partnerships, bo@northwind.test.
- Both sides may share confidential information.
- The NDA lasts 2 years. Secrets stay protected for 3 years.
- Delaware law. Courts in New Castle County.`,
    expect: {
      party1: {
        company: "Acme Robotics",
        name: "Ana Diaz",
        title: "CEO",
        email: "ana@acme.test",
      },
      party2: {
        company: "Northwind Labs",
        name: "Bo Chen",
        title: "Head of Partnerships",
        email: "bo@northwind.test",
      },
      mndaTerm: { option: "expires", value: { amount: 2, unit: "years" } },
      confidentialityTerm: {
        option: "fixed",
        value: { amount: 3, unit: "years" },
      },
      governingLaw: { state: "DE", courtLocation: "New Castle County" },
    },
  },
  {
    name: "biotech partnership talks",
    document: "mutual-nda",
    opening:
      "I run Helix Bio. We're talking with Pinecrest Pharma about a research partnership and need an NDA first.",
    facts: `- Party 1: Helix Bio. Signer: Priya Raman, COO, priya@helixbio.test.
- Party 2: Pinecrest Pharma. Signer: Marcus Lee, VP Business Development, marcus@pinecrest.test.
- Purpose: evaluating a possible research partnership.
- The NDA lasts 18 months. Secrets stay protected forever.
- California law. Courts in San Francisco.`,
    expect: {
      party1: {
        company: "Helix Bio",
        name: "Priya Raman",
        title: "COO",
        email: "priya@helixbio.test",
      },
      party2: {
        company: "Pinecrest Pharma",
        name: "Marcus Lee",
        title: "VP Business Development",
        email: "marcus@pinecrest.test",
      },
      // Not the default (1 year): a model that never asks can't pass.
      mndaTerm: { option: "expires", value: { amount: 18, unit: "months" } },
      confidentialityTerm: { option: "perpetual" },
      governingLaw: { state: "CA", courtLocation: "San Francisco" },
    },
  },
  {
    name: "acquisition talks, open-ended",
    document: "mutual-nda",
    opening:
      "Northstar Analytics may buy our company, Brightline Data. We need an NDA before we open our books to them.",
    facts: `- Party 1: Brightline Data. Signer: Sofia Novak, Founder and CEO, sofia@brightline.test.
- Party 2: Northstar Analytics. Signer: James Okafor, Head of Corporate Development, james@northstar.test.
- Purpose: evaluating a possible acquisition of Brightline Data.
- The NDA runs until one side ends it. Secrets stay protected for 5 years.
- New York law. Courts in New York County.`,
    expect: {
      party1: {
        company: "Brightline Data",
        name: "Sofia Novak",
        title: "Founder and CEO",
        email: "sofia@brightline.test",
      },
      party2: {
        company: "Northstar Analytics",
        name: "James Okafor",
        title: "Head of Corporate Development",
        email: "james@northstar.test",
      },
      mndaTerm: { option: "untilTerminated" },
      confidentialityTerm: {
        option: "fixed",
        value: { amount: 5, unit: "years" },
      },
      governingLaw: { state: "NY", courtLocation: "New York County" },
    },
  },
]
