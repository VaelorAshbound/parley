import { z } from "zod"

// Workers and our CSP block `new Function`, which Zod's JIT uses; jitless
// keeps every schema safe to run here (spec §5 Zod). Import z from this file.
z.config({ jitless: true })

export { z }
