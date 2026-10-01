import type { DocumentId } from "@workspace/documents"

// The eleven agreements as the app lists them, in the design's order, with
// the short plain-words lines from the approved design (brand.md canvas).
export const documentList: {
  id: DocumentId
  name: string
  description: string
}[] = [
  {
    id: "mutual-nda",
    name: "Mutual NDA",
    description: "Share confidential information both ways, safely.",
  },
  {
    id: "csa",
    name: "Cloud Service Agreement",
    description: "Sell or buy SaaS and cloud software.",
  },
  {
    id: "sla",
    name: "Service Level Agreement",
    description: "Uptime targets, support times and service credits.",
  },
  {
    id: "dpa",
    name: "Data Processing Agreement",
    description: "Who does what with personal data.",
  },
  {
    id: "ai-addendum",
    name: "AI Addendum",
    description: "Rules for AI inputs, outputs and model training.",
  },
  {
    id: "pilot-agreement",
    name: "Pilot Agreement",
    description: "Let a customer try your product before buying.",
  },
  {
    id: "design-partner-agreement",
    name: "Design Partner Agreement",
    description: "Early access in exchange for feedback.",
  },
  {
    id: "psa",
    name: "Professional Services Agreement",
    description: "Services and deliverables under statements of work.",
  },
  {
    id: "software-license-agreement",
    name: "Software License Agreement",
    description: "License software that customers run themselves.",
  },
  {
    id: "partnership-agreement",
    name: "Partnership Agreement",
    description: "Two companies working together, duties spelled out.",
  },
  {
    id: "baa",
    name: "Business Associate Agreement",
    description: "Handle health data (PHI) under HIPAA.",
  },
]

/**
 * The short name the app shows for a document ("Mutual NDA"), or "New draft"
 * before the chat has picked one.
 */
export function documentName(id: DocumentId | null) {
  if (id === null) return "New draft"
  // Every catalog id is in the list (tested).
  return documentList.find((document) => document.id === id)?.name ?? id
}
