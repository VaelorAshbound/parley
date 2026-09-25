import { ORPCError } from "@orpc/client"

import type { ExportFormat } from "@/server/quota"

// What to tell someone whose download didn't happen, from the typed error
// (spec §5 API: typed errors drive the UI, never string matching). Each
// limit comes with the way past it.

export type ExportProblem = {
  message: string
  action?: { label: string; href: string }
}

/** The upgrade page (T26). */
const PRICING = "/pricing"

const TRY_AGAIN: ExportProblem = {
  message: "We couldn't make the file. Please try again.",
}

function list(labels: string[]) {
  const shown = labels.slice(0, 3)
  const more = labels.length - shown.length
  if (more > 0) return `${shown.join(", ")} and ${more} more`
  if (shown.length === 1) return shown[0] ?? ""
  return `${shown.slice(0, -1).join(", ")} and ${shown.at(-1)}`
}

function dataOf<T>(error: ORPCError<string, unknown>) {
  return error.data as T
}

export function exportProblem(
  error: unknown,
  { draftPath }: { format: ExportFormat; draftPath: string }
): ExportProblem {
  if (!(error instanceof ORPCError) || !error.defined) return TRY_AGAIN
  switch (error.code) {
    case "UNAUTHORIZED":
      return {
        message:
          "Create a free account to download. Your draft comes with you.",
        action: {
          label: "Create an account",
          href: `/sign-up?redirect=${encodeURIComponent(draftPath)}`,
        },
      }
    case "EMAIL_NOT_VERIFIED":
      return { message: "Confirm your email to download. We sent you a link." }
    case "QUOTA_EXCEEDED":
      return {
        message: `You've used your ${dataOf<{ limit: number }>(error).limit} free documents this month. Documents you already downloaded stay free.`,
        action: { label: "Get unlimited with Pro", href: PRICING },
      }
    case "PRO_REQUIRED":
      return {
        message: "Word files come with Pro. You can still download a PDF.",
        action: { label: "Upgrade to Pro", href: PRICING },
      }
    case "INCOMPLETE": {
      const { missing } = dataOf<{ missing: { label: string }[] }>(error)
      return {
        message: `Fill in ${list(missing.map(({ label }) => label))} first.`,
      }
    }
    case "NO_DOCUMENT":
      return { message: "Pick an agreement first." }
    case "NOT_FOUND":
      return { message: "We couldn't find that draft." }
    default:
      return TRY_AGAIN
  }
}
