import { z } from "zod"

// Draft rules the rename form and the API share, so the browser shows the
// same message the server would give.

/** The longest title a draft can have (the sidebar shows about 30 letters). */
export const TITLE_MAX = 100

export const draftTitle = z
  .string()
  .trim()
  .min(1, "Please give the draft a name.")
  .max(TITLE_MAX, `Please keep the name under ${TITLE_MAX} characters.`)

/** The longest search a search box sends. */
export const QUERY_MAX = 100

/** A copy's title: the original's, marked, within the limit. */
export function copyTitle(title: string) {
  const mark = " (copy)"
  return title.slice(0, TITLE_MAX - mark.length).trimEnd() + mark
}
