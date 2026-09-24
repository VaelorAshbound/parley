import { psa } from "./psa.ts"
import { softwareLicenseAgreement } from "./software-license-agreement.ts"
import { pilotAgreement } from "./pilot-agreement.ts"
import { designPartnerAgreement } from "./design-partner-agreement.ts"
import { partnershipAgreement } from "./partnership-agreement.ts"
import { mutualNda } from "./mutual-nda.ts"

/** Every document Parley drafts, by catalog id. */
export const definitions = {
  "partnership-agreement": partnershipAgreement,
  "design-partner-agreement": designPartnerAgreement,
  "pilot-agreement": pilotAgreement,
  "software-license-agreement": softwareLicenseAgreement,
  psa: psa,
  "mutual-nda": mutualNda,
}

export type DocumentId = keyof typeof definitions
