// Runs the test Postgres in its own process. embedded-postgres registers an
// exit hook (async-exit-hook) that ends the process with code 0 on
// `beforeExit`; inside Vitest's process that would erase the failure code, so
// a red run would pass CI. Here the hook only stops this server, as intended.
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import EmbeddedPostgres from "embedded-postgres"

const port = Number(process.argv[2])
const databaseDir = await mkdtemp(join(tmpdir(), "parley-pg-"))
const server = new EmbeddedPostgres({
  databaseDir,
  port,
  user: "postgres",
  password: "postgres",
  persistent: false,
  // The Worker tests call the app inside the test's own request, so each
  // call's database socket stays open until its test file ends (a real
  // request closes it). Postgres's default of 100 ran out once the auth
  // tests grew (T21).
  postgresFlags: ["-c", "max_connections=400"],
  onLog: () => {},
})
await server.initialise()
await server.start()
await server.createDatabase("parley")

process.once("SIGTERM", () => {
  void server
    .stop()
    .then(() => rm(databaseDir, { recursive: true, force: true }))
    .then(() => process.exit(0))
})
// The parent waits for this line.
console.log("ready")
