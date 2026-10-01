import { z } from "zod"

/**
 * `?redirect=`: where to go after signing in, up or out. Only a path on
 * Parley, so a link can't send someone to another site after they sign in
 * (an open redirect). "//x" and "/\x" count as other sites: browsers read
 * both as a host.
 */
export const redirectSearch = z.object({
  redirect: z
    .string()
    .regex(/^\/(?![/\\])/)
    .optional()
    .catch(undefined),
})

export type RedirectSearch = z.infer<typeof redirectSearch>

/**
 * The auth pages' search: `?redirect=`, plus the `?error=` code Better Auth
 * adds when it sends the browser back with a problem (Google or GitHub
 * refused, a confirmation link expired).
 */
export const authSearch = redirectSearch.extend({
  error: z.string().max(64).optional().catch(undefined),
})
