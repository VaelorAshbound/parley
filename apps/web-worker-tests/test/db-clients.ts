// The database clients the /api app opens inside the tests' calls, closed
// after each test (a setup file, vitest.config.ts).
//
// A real Worker's request ends and takes its socket with it. Here the app
// runs inside the test's own request (helpers.ts `call`), so every call's
// client stayed open until its whole test file ended. Files run side by
// side, so one run held 350+ idle Postgres backends at once: the test
// Postgres refused new ones (53300 too_many_connections, failing whatever
// test came next) and the idle backends took gigabytes of memory.
import { afterAll, expect, onTestFinished, vi } from "vitest"

type Client = { end(): Promise<void> }

const app = vi.hoisted(() => ({
  /** Calls running now: a client opened meanwhile is the app's. */
  running: 0,
  open: new Set<Client>(),
}))

vi.mock(import("@workspace/db"), async (original) => {
  const db = await original()
  return {
    ...db,
    async connect(connectionString: string) {
      const made = await db.connect(connectionString)
      if (app.running > 0) app.open.add(made.$client)
      return made
    },
  }
})

/**
 * Runs one call into the app and closes the clients it opened once the test
 * is over (or the file, for a call made outside a test), so a response body
 * read later still has its database.
 */
export async function closingAppClients<T>(run: () => Promise<T>) {
  app.running++
  try {
    return await run()
  } finally {
    app.running--
    const close = async () => {
      const clients = [...app.open]
      app.open.clear()
      await Promise.allSettled(clients.map((client) => client.end()))
    }
    if (expect.getState().currentTestName === undefined) afterAll(close)
    else onTestFinished(close)
  }
}

/** The backend ids of the app's clients still open (for harness.test.ts). */
export function openAppClients() {
  // pg sets processID (the backend's pid); @types/pg leaves it out.
  return [...app.open].map(
    (client) => (client as Client & { processID: number | null }).processID
  )
}
