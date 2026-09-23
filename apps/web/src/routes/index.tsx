import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({ component: Home })

// Placeholder until the app shell (T15).
function Home() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-2 p-6">
      <h1 className="text-2xl font-medium">Parley</h1>
      <p className="text-muted-foreground">
        Draft legal agreements by chatting.
      </p>
    </main>
  )
}
