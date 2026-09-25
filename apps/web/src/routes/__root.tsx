import type { QueryClient } from "@tanstack/react-query"
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router"
import { Toaster } from "@workspace/ui/components/toast"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import appCss from "@workspace/ui/globals.css?url"
import { useEffect } from "react"
import { fontPreloads } from "@workspace/ui/lib/fonts"

import { NotFound, RouteError } from "./-components/states"

import { ThemeProvider } from "@/components/theme-provider"
import type { Orpc } from "@/lib/orpc"

export type RouterContext = { queryClient: QueryClient; orpc: Orpc }

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Parley" },
    ],
    links: [
      ...fontPreloads,
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  notFoundComponent: NotFound,
  errorComponent: RouteError,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  // Marks the page as interactive, so browser tests act after hydration
  // instead of clicking a button React doesn't handle yet.
  useEffect(() => {
    document.documentElement.dataset.hydrated = ""
  }, [])
  return (
    // The theme script sets a class on <html> before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider defaultTheme="system" storageKey="theme">
          <TooltipProvider>
            {/* Toasts (a delete's Undo, T22), in a landmark F6 jumps to. */}
            <Toaster>{children}</Toaster>
          </TooltipProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
