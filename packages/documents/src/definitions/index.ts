import type { DocumentDefinition } from "../define.ts"
import { aiAddendum } from "./ai-addendum.ts"
import { baa } from "./baa.ts"
import { csa } from "./csa.ts"
import { designPartnerAgreement } from "./design-partner-agreement.ts"
import { dpa } from "./dpa.ts"
import { mutualNda } from "./mutual-nda.ts"
import { partnershipAgreement } from "./partnership-agreement.ts"
import { pilotAgreement } from "./pilot-agreement.ts"
import { psa } from "./psa.ts"
import { sla } from "./sla.ts"
import { softwareLicenseAgreement } from "./software-license-agreement.ts"

/** Every document Parley drafts, by catalog id, in catalog order. */
export const definitions = {
  "ai-addendum": aiAddendum,
  baa,
  csa,
  "design-partner-agreement": designPartnerAgreement,
  dpa,
  "mutual-nda": mutualNda,
  "partnership-agreement": partnershipAgreement,
  "pilot-agreement": pilotAgreement,
  psa,
  sla,
  "software-license-agreement": softwareLicenseAgreement,
}

export type DocumentId = keyof typeof definitions

export function isDocumentId(value: unknown): value is DocumentId {
  return typeof value === "string" && Object.hasOwn(definitions, value)
}

/**
 * The definition for an id, typed for any document. Indexing `definitions`
 * with a DocumentId gives a union that the generic engine functions can't
 * take; each member widens to DocumentDefinition on its own.
 */
export function definitionOf(id: DocumentId): DocumentDefinition {
  return definitions[id]
}
