import type { DocumentId } from "@workspace/documents"

// Picking the agreement from a situation, told in the user's own words
// (spec §6: "we're about to share our roadmap with a vendor" → Mutual NDA).
// `also` lists a second answer a careful lawyer would accept too.

export type ChooseCase = {
  name: string
  situation: string
  expect: DocumentId
  also?: DocumentId[]
}

export const chooseCases: ChooseCase[] = [
  {
    name: "roadmap with a vendor",
    situation:
      "We're about to share our product roadmap with a vendor before we sign anything.",
    expect: "mutual-nda",
  },
  {
    name: "selling SaaS",
    situation:
      "We sell a project management web app by subscription. A 200-person company wants to buy 50 seats for a year.",
    expect: "csa",
  },
  {
    name: "uptime promise",
    situation:
      "A customer of our hosted API wants written uptime targets, support response times and credits if we miss them.",
    expect: "sla",
  },
  {
    name: "personal data",
    situation:
      "Our customer is a European retailer. Our software stores their shoppers' names and emails for them. They want terms on how we handle that personal data.",
    expect: "dpa",
  },
  {
    name: "health data",
    situation:
      "We're building scheduling software for a dental clinic in the US, and we'll store patients' health information.",
    expect: "baa",
  },
  {
    name: "free trial",
    situation:
      "A hospital group wants to try our software for 60 days before deciding to buy it.",
    expect: "pilot-agreement",
  },
  {
    name: "early feedback",
    situation:
      "We're giving a startup early access to our unreleased product for free, and in return they give us feedback every two weeks.",
    expect: "design-partner-agreement",
  },
  {
    name: "agency project",
    situation:
      "We're hiring an agency to redesign our website, delivered in phases under separate statements of work.",
    expect: "psa",
  },
  {
    name: "on-premise software",
    situation:
      "A bank wants to license our fraud detection software and run it on its own servers, not in our cloud.",
    expect: "software-license-agreement",
  },
  {
    name: "AI training rules",
    situation:
      "Our SaaS customer wants rules about how our AI features use their data, and a promise we won't train models on it.",
    expect: "ai-addendum",
  },
  {
    name: "co-marketing",
    situation:
      "Two companies want to work together: we refer customers to each other and market a joint offering, each with set duties.",
    expect: "partnership-agreement",
  },
]
