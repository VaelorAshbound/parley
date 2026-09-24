import { psa } from "./psa.ts"
import { mutualNda } from "./mutual-nda.ts"

/** Every document Parley drafts, by catalog id. */
export const definitions = {
  psa: psa,
  "mutual-nda": mutualNda,
}

export type DocumentId = keyof typeof definitions
