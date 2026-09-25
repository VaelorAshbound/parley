import { describe, expect, it, vi } from "vite-plus/test"

import worker from "./server"
import { scheduled } from "./server/cron"

// The Start server entry is a virtual module only the TanStack Start plugin
// can build; this test is about the Worker's handlers, not SSR.
vi.mock(import("@tanstack/react-start/server-entry"), () => ({
  default: { fetch: vi.fn<(request: Request) => Response>() },
}))

describe("the Worker entry", () => {
  it("runs the nightly purge on the Cron Trigger", () => {
    // Without it, production silently stops purging: `satisfies
    // ExportedHandler` allows a missing handler, and Previews never run crons.
    expect(worker.scheduled).toBe(scheduled)
  })
})
