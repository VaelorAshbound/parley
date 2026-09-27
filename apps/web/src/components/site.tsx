import { Link } from "@tanstack/react-router"
import { buttonVariants } from "@workspace/ui/components/button"
import { SidebarTrigger, useSidebar } from "@workspace/ui/components/sidebar"
import { cn } from "@workspace/ui/lib/utils"
import type { ReactNode } from "react"

import { LogoMark } from "@/components/logo"

// The header and footer of Parley's own pages (the start page, Pricing),
// after the approved design (brand.md canvas, Main and Pricing).

/**
 * The wordmark, Pricing and, for a visitor, the way to sign in. `children`
 * go last, at the right (Pricing's "Start drafting").
 */
export function SiteHeader({
  isAccount,
  children,
}: {
  isAccount: boolean
  children?: ReactNode
}) {
  // An open sidebar already shows the wordmark beside this one.
  const { state } = useSidebar()
  return (
    <header className="flex h-14 shrink-0 items-center gap-1 px-3 md:h-17 md:pr-14 md:pl-12 @min-[84rem]:pl-23">
      <SidebarTrigger className="md:hidden" />
      <Link
        to="/"
        className={cn(
          "px-1 font-serif text-[1.4375rem] font-medium tracking-[-0.02em] md:px-0",
          state === "expanded" && "md:invisible"
        )}
      >
        Parley
      </Link>
      <nav aria-label="Site" className="ml-auto flex items-center gap-1">
        <Link
          to="/pricing"
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "h-9 px-3 text-ink-2 aria-[current=page]:text-foreground"
          )}
        >
          Pricing
        </Link>
        {!isAccount && (
          <Link
            to="/sign-in"
            className={cn(buttonVariants({ variant: "outline" }), "h-9 px-4")}
          >
            Sign in
          </Link>
        )}
        {children}
      </nav>
    </header>
  )
}

/** The wordmark, the credit and the demo note. */
export function SiteFooter({ isAccount }: { isAccount: boolean }) {
  return (
    <footer className="mt-16 flex flex-col gap-4 border-t pt-5.5 text-[12.5px] text-muted-foreground md:mt-18 md:flex-row md:items-center md:justify-between md:gap-6">
      <span className="flex items-center gap-2 text-foreground">
        <LogoMark className="size-4.5" />
        <span className="font-serif text-base font-medium tracking-[-0.02em]">
          Parley
        </span>
      </span>
      <span>
        Standard terms © <CommonPaperLink />, <LicenseLink /> · Not legal advice
      </span>
      {!isAccount && (
        <nav aria-label="Footer" className="flex gap-5">
          <Link to="/sign-in" className="text-ink-2 hover:text-foreground">
            Sign in
          </Link>
        </nav>
      )}
    </footer>
  )
}

export function CommonPaperLink() {
  return (
    <a
      href="https://commonpaper.com/standards/"
      target="_blank"
      rel="noreferrer"
      className="underline decoration-input underline-offset-2 hover:text-foreground"
    >
      Common Paper
    </a>
  )
}

export function LicenseLink() {
  return (
    <a
      href="https://creativecommons.org/licenses/by/4.0/"
      target="_blank"
      rel="noreferrer"
      className="underline decoration-input underline-offset-2 hover:text-foreground"
    >
      CC BY 4.0
    </a>
  )
}
