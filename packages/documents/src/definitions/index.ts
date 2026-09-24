import { mutualNda } from "./mutual-nda.ts"

/** Every document Parley drafts, by catalog id. */
export const definitions = {
  "mutual-nda": mutualNda,
}

export type DocumentId = keyof typeof definitions
