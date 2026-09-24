import { psa } from "./psa.ts"
import { softwareLicenseAgreement } from "./software-license-agreement.ts"
import { pilotAgreement } from "./pilot-agreement.ts"
import { designPartnerAgreement } from "./design-partner-agreement.ts"
import { partnershipAgreement } from "./partnership-agreement.ts"
import { dpa } from "./dpa.ts"
import { baa } from "./baa.ts"
import { csa } from "./csa.ts"
import { sla } from "./sla.ts"
import { aiAddendum } from "./ai-addendum.ts"
import { mutualNda } from "./mutual-nda.ts"

/** Every document Parley drafts, by catalog id. */
export const definitions = {
  "ai-addendum": aiAddendum,
  sla: sla,
  csa: csa,
  baa: baa,
  dpa: dpa,
  "partnership-agreement": partnershipAgreement,
  "design-partner-agreement": designPartnerAgreement,
  "pilot-agreement": pilotAgreement,
  "software-license-agreement": softwareLicenseAgreement,
  psa: psa,
  "mutual-nda": mutualNda,
}

export type DocumentId = keyof typeof definitions
