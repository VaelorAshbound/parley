import { z } from "zod"

// Workers and our CSP block `new Function`, and Zod decides whether to compile
// a schema when the schema is built. So this runs before any schema in the
// package exists: every module imports `z` from here, never from "zod".
z.config({ jitless: true })

export { z }

/**
 * The engine's one type assertion. Some schemas are built at runtime from a
 * definition (a choice from its options, a document from its fields), so
 * TypeScript can't follow their output type. Each caller states the type the
 * schema produces, and the type tests (test/*.test-d.ts) prove they agree.
 */
export function typed<T>(schema: z.ZodType): z.ZodType<T> {
  return schema as z.ZodType<T>
}
