import { connect } from "@workspace/db"
import { getRequest } from "@tanstack/react-start/server"
import { env, waitUntil } from "cloudflare:workers"

import { createModel } from "./ai/model"
import { createAuth } from "./auth"

// The database client and auth instance for the page request being rendered
// (SSR loaders and server functions). One per request, made on first use;
// the WeakMap forgets it with the request, so nothing is shared between
// requests in one isolate.
const byRequest = new WeakMap<Request, ReturnType<typeof create>>()

async function create() {
  const db = await connect(env.HYPERDRIVE.connectionString)
  return {
    db,
    auth: createAuth({ db, env, waitUntil }),
    model: createModel(env),
    waitUntil,
  }
}

export function requestServices() {
  const request = getRequest()
  let services = byRequest.get(request)
  if (!services) {
    services = create()
    byRequest.set(request, services)
  }
  return services
}
