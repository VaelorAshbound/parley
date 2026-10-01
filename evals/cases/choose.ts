import type { DocumentId } from "@workspace/documents"

// Picking the agreement from a situation, told in the user's own words
// (spec §6: "we're about to share our roadmap with a vendor" → Mutual NDA).
// Two situations for each agreement, worded differently. `also` lists a
// second answer a careful lawyer would accept too. `suggests` lists the
// related agreements a good reply names (T30): at least one of them.

export type ChooseCase = {
  name: string
  situation: string
  expect: DocumentId
  also?: DocumentId[]
  suggests?: DocumentId[]
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
    suggests: ["sla", "dpa", "ai-addendum"],
  },
  {
    name: "uptime promise",
    situation:
      "A customer of our hosted API wants written uptime targets, support response times and credits if we miss them.",
    expect: "sla",
    suggests: ["csa"],
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
      "We already have a service contract with a US dental clinic for our scheduling software. Now, because we store their patients' health information, they need us to sign the HIPAA agreement.",
    expect: "baa",
  },
  {
    name: "free trial",
    situation:
      "A hospital group wants to try our software for 60 days before deciding to buy it.",
    expect: "pilot-agreement",
    suggests: ["csa"],
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
    suggests: ["csa"],
  },
  {
    name: "co-marketing",
    situation:
      "Two companies want to work together: we refer customers to each other and market a joint offering, each with set duties.",
    expect: "partnership-agreement",
  },
  {
    name: "HR platform seats",
    situation:
      "Employees log in to our HR platform in their browser. A retailer wants 300 accounts on a two-year plan.",
    expect: "csa",
    suggests: ["sla", "dpa", "ai-addendum"],
  },
  {
    name: "support response times",
    situation:
      "A customer of our hosted platform wants promised support response times, and money back when we're slow.",
    expect: "sla",
  },
  {
    name: "GDPR terms for employee data",
    situation:
      "A French customer asks us to sign GDPR terms, because our payroll app processes their employees' personal data for them.",
    expect: "dpa",
  },
  {
    name: "AI writing assistant",
    situation:
      "Our cloud product just added an AI writing assistant. A customer wants terms on what we may do with their prompts and the AI's output.",
    expect: "ai-addendum",
  },
  {
    name: "paid trial",
    situation:
      "A logistics company wants a paid 90-day trial of our route planning app before a full purchase.",
    expect: "pilot-agreement",
  },
  {
    name: "beta for feedback",
    situation:
      "We haven't launched yet. Three friendly companies will use our beta for free and join monthly product calls to shape it.",
    expect: "design-partner-agreement",
  },
  {
    name: "ERP setup, billed hourly",
    situation:
      "A consulting firm will set up and configure our new ERP system over 3 months, billed by the hour.",
    expect: "psa",
  },
  {
    name: "offline plant software",
    situation:
      "A factory wants to install our machine monitoring software on computers in its plants. It runs without the internet.",
    expect: "software-license-agreement",
  },
  {
    name: "lead sharing",
    situation:
      "We and a payments company want to promote each other's product to our own customers and share leads, each with clear duties.",
    expect: "partnership-agreement",
  },
  {
    name: "claims billing",
    situation:
      "We're a billing company. A US hospital hires us to process its insurance claims, so we'll handle patients' protected health information. They want the HIPAA terms signed first.",
    expect: "baa",
  },
]
