import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router"
import appCss from "@workspace/ui/globals.css?url"
import { fontPreloads } from "@workspace/ui/lib/fonts"

import { ThemeProvider } from "@/components/theme-provider"

export const Route = createRootRoute({
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
  notFoundComponent: () => (
    <main className="container mx-auto p-4 pt-16">
      <h1>Page not found</h1>
      <p>This page does not exist.</p>
    </main>
  ),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    // The theme script sets a class on <html> before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider defaultTheme="system" storageKey="theme">
          {children}
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
