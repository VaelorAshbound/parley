// Stands in for the Workers runtime module in browser tests. Nothing here
// runs: it only lets Vite's dependency scan follow an import of the server
// code (through the session module) to the end, instead of giving up and
// finding dependencies late, which reloads the page mid-run on a cold cache.
export const env = {}
export function waitUntil(_promise: Promise<unknown>) {}
