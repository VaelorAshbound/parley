import { Hono } from "hono"

import { spike } from "./spike"

// The /api layer. Sub-apps (auth, rpc) join here with app.route() as they land.
export const api = new Hono<{ Bindings: Env }>()
  .basePath("/api")
  // Hono answers HEAD from the GET handler on its own.
  .get("/health", (c) => c.json({ ok: true as const }))
  .route("/spike", spike)

export type Api = typeof api

// The default export makes this module a Worker entry for the workerd tests.
export default api
