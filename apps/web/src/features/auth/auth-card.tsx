import { useId, type ReactNode } from "react"

// The card of every auth page (sign-in, sign-up, password, email, code),
// in the start and pricing pages' Paper & Ink: a Newsreader title at the
// brand's Title size, room to breathe, even padding on every side, and one
// ink button per page (the page's own next step; PAR-45).

/** The height and type of an auth page's buttons, links styled as one too. */
export const authButton = "h-11 w-full text-[15px]"

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description: ReactNode
  children: ReactNode
  /** The way to the other auth page ("New to Parley? Create an account"). */
  footer?: ReactNode
}) {
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col rounded-2xl border bg-card px-6 py-8 text-card-foreground sm:p-10"
    >
      <h1
        id={titleId}
        className="font-serif text-title-sm text-balance sm:text-title"
      >
        {title}
      </h1>
      <p className="mt-3 text-body text-pretty wrap-anywhere text-ink-2">
        {description}
      </p>
      {/* Boxes as tall as the buttons, for one even rhythm. */}
      <div className="mt-8 flex flex-col gap-5 [&_[data-slot=input-group]]:h-10 [&_[data-slot=input]]:h-10">
        {children}
      </div>
      {footer && (
        <div className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">
          {footer}
        </div>
      )}
    </section>
  )
}

/** The link in an auth card's footer. */
export const footerLink =
  "font-medium text-blue-ink underline-offset-4 hover:underline"
