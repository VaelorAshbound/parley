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
