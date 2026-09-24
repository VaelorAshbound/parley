import { psa } from "./psa.ts"
import { softwareLicenseAgreement } from "./software-license-agreement.ts"
import { pilotAgreement } from "./pilot-agreement.ts"
import { mutualNda } from "./mutual-nda.ts"

/** Every document Parley drafts, by catalog id. */
export const definitions = {
  "pilot-agreement": pilotAgreement,
  "software-license-agreement": softwareLicenseAgreement,
  psa: psa,
  "mutual-nda": mutualNda,
}

export type DocumentId = keyof typeof definitions
