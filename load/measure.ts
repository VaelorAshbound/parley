// Small pieces the performance scripts share (T35).

/** Nearest-rank percentile: always one of the samples. */
export function percentile(samples: readonly number[], p: number): number {
  if (samples.length === 0) throw new Error("percentile: no samples")
  const sorted = samples.toSorted((a, b) => a - b)
  const rank = Math.ceil((p / 100) * sorted.length)
  return sorted[Math.max(rank, 1) - 1] as number
}

/**
 * A chunk of the chat stream (AI SDK UI message chunks) that shows the
 * model's first output: text, or a tool call, which is what fills in the
 * document. The frames before it (start, start-step, text-start) are sent
 * before the model says anything.
 */
export function isFirstToken(chunk: {
  type: string
  [field: string]: unknown
}): boolean {
  return (
    chunk.type === "text-delta" ||
    chunk.type === "reasoning-delta" ||
    chunk.type.startsWith("tool-input-")
  )
}

/**
 * The URL a load test may run against: a Worker Preview (workers.dev) or a
 * local server, never production. The scripts also check that the target
 * runs the scripted AI (/api/version), which production never does.
 */
export function loadTestTarget(url: string | undefined): string {
  if (!url) throw new Error("Set PREVIEW_URL to the Worker Preview to test.")
  const { hostname, origin } = new URL(url)
  if (hostname === "parley.runtimedrift.dev")
    throw new Error("Never load-test production.")
  if (
    !hostname.endsWith(".workers.dev") &&
    hostname !== "localhost" &&
    hostname !== "127.0.0.1"
  )
    throw new Error(`${hostname} is not a Worker Preview or a local server.`)
  return origin
}
