import { z } from "zod"

// Workers and our CSP (src/server/headers.ts) block `new Function`, which
// Zod's JIT uses; jitless keeps every schema safe to run in both (spec §5
// Zod). Without it, the browser reports a CSP violation each time Zod checks
// whether it may compile. router.tsx imports this first, before any route
// builds a schema.
z.config({ jitless: true })

export { z }
