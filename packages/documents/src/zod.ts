import { z } from "zod"

// Workers and our CSP block `new Function`, and Zod decides whether to compile
// a schema when the schema is built. So this runs before any schema in the
// package exists: every module imports `z` from here, never from "zod".
z.config({ jitless: true })

export { z }
