import type { InferResponseType } from "hono/client"
import { hc } from "hono/client"
import { expectTypeOf, test } from "vite-plus/test"

import type { Api } from "./api"

test("the health route's response type is { ok: true }", () => {
  const client = hc<Api>("http://localhost")
  type Health = InferResponseType<typeof client.api.health.$get>

  expectTypeOf<Health>().toEqualTypeOf<{ ok: true }>()
})
