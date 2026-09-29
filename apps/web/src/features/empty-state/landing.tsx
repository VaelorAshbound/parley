import { DISCLAIMER, type DocumentId } from "@workspace/documents"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { ArrowRightIcon } from "lucide-react"
import { useRef, type ReactNode } from "react"

import { CommonPaperLink, LicenseLink, SiteHeader } from "@/components/site"
import { Composer } from "@/features/chat/composer"
import { documentList } from "@/lib/documents"

import { HeroArt } from "./hero-art"
import { starters } from "./starters"

// The start page (spec §1: the empty state is the landing page), after the
// approved design (brand.md canvas, Main): the headline, the reply box,
// examples that start a draft in one click, the library of all eleven
// agreements, and the credit and demo note in plain sight.

/** How a draft starts: from an agreement, or from a first message. */
export type Start = { documentId: DocumentId } | { text: string }

export function Landing({
  isAccount,
  busy,
  picking,
  onStart,
  turnstile,
  problem,
}: {
  /** Signed in with an account: no "Sign in" and no "no account needed". */
  isAccount: boolean
  busy: boolean
  /** The agreement whose draft is being made. */
  picking?: DocumentId
  onStart: (from: Start) => void
  /** Cloudflare's check, when it wants a click. */
  turnstile?: ReactNode
  /** Why the last start failed. */
  problem?: ReactNode
}) {
  const deal = useRef<HTMLTextAreaElement>(null)

  return (
    // The art and the two-column library follow the room the page has, not
    // the window: an open sidebar takes 16rem of it.
    <div className="@container flex flex-1 flex-col">
      <SiteHeader isAccount={isAccount} />
      <div className="flex w-full flex-1 flex-col px-6 pt-6 md:px-12 md:pt-10 @min-[84rem]:pr-14 @min-[84rem]:pl-23">
        <section className="grid gap-x-10 @min-[72rem]:grid-cols-[minmax(0,560px)_minmax(0,1fr)] @min-[84rem]:grid-cols-[600px_minmax(0,1fr)] @min-[84rem]:pt-4">
          <div className="flex max-w-150 flex-col">
            {!isAccount && (
              <Badge
                variant="outline"
                className="h-7 self-start rounded-full bg-card px-3 text-[12.5px] font-normal text-ink-2"
              >
                Free to try · No account needed
              </Badge>
            )}
            <h1 className="mt-6 font-serif text-[2.75rem] leading-[1.02] font-normal tracking-[-0.03em] text-balance md:mt-7 md:text-6xl lg:text-[4.75rem] lg:leading-[0.98] lg:tracking-[-0.032em]">
              Describe the deal. Watch the contract{" "}
              <em className="hero-marker -mx-1.5 px-1.5 text-blue-ink">
                fill itself in.
              </em>
            </h1>
            <p className="mt-6 max-w-[32.5rem] text-lg leading-[1.55] text-pretty text-ink-2 md:mt-7">
              Tell Parley what you’re working on. It picks the right standard
              agreement and fills it in beside your chat, explaining each choice
              in plain words.
            </p>

            <div className="mt-8 md:mt-9">
              <Composer
                variant="start"
                busy={busy}
                label="Describe your deal"
                placeholder="What are you agreeing to, and with whom?"
                inputRef={deal}
                onSend={(text) => onStart({ text })}
              />
            </div>
            <ul aria-label="Examples" className="mt-4.5 flex flex-wrap gap-2">
              {starters.map((starter) => (
                <li key={starter.label}>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8.5 rounded-full bg-transparent px-3.5 text-[13.5px] font-normal text-ink-2 max-md:h-11 data-disabled:opacity-50"
                    // Keeps keyboard focus while a start runs (and after
                    // one fails), where plain disabled would drop it.
                    disabled={busy}
                    focusableWhenDisabled
                    onClick={() => onStart({ text: starter.prompt })}
                  >
                    {starter.label}
                  </Button>
                </li>
              ))}
            </ul>
            {/* Next to the box. It scrolls itself into view when Cloudflare
                asks for a click (useTurnstile). */}
            {turnstile}
            {/* Scrolled to when it appears: a start from the library below
                may be what failed. Not on load: the page stays at the top. */}
            {problem && (
              <div ref={(note) => note?.scrollIntoView({ block: "nearest" })}>
                {problem}
              </div>
            )}

            <div className="mt-7 flex max-w-[32.5rem] flex-col gap-1 text-[12.5px] leading-relaxed text-muted-foreground">
              <p>
                Standard agreements by <CommonPaperLink />, used under{" "}
                <LicenseLink />.
              </p>
              <p>{DISCLAIMER}</p>
            </div>
          </div>

          {/* Smaller when the page is narrower (an open sidebar, a laptop):
              zoom scales its layout box too, so the grid makes room. */}
          <HeroArt className="hidden @min-[72rem]:block @min-[72rem]:[zoom:0.72] @min-[84rem]:[zoom:1]" />
        </section>

        <section
          aria-labelledby="library-title"
          className="mt-20 grid gap-x-20 gap-y-8 md:mt-28 @min-[72rem]:mt-34 @min-[72rem]:grid-cols-[minmax(0,25rem)_minmax(0,1fr)]"
        >
          <div className="flex flex-col gap-4.5">
            <span
              id="library"
              className="text-label text-muted-foreground uppercase"
            >
              The library
            </span>
            <h2
              id="library-title"
              className="font-serif text-4xl leading-[1.04] font-normal tracking-[-0.024em] text-balance md:text-[2.875rem]"
            >
              Eleven agreements.{" "}
              <em className="text-blue-ink">One conversation.</em>
            </h2>
            <p className="leading-relaxed text-pretty text-ink-2">
              Every document is a Common Paper standard, kept word for word.
              Parley fills in the cover page with you and tells you what each
              term means.
            </p>
          </div>
          <ol
            aria-labelledby="library"
            className="grid gap-x-10 @min-[40rem]:grid-cols-2"
          >
            {documentList.map((document, index) => (
              <li key={document.id} className="border-t">
                <button
                  type="button"
                  // aria-disabled, not disabled: focus stays on the button.
                  aria-disabled={busy || undefined}
                  onClick={() => {
                    if (!busy) onStart({ documentId: document.id })
                  }}
                  className="group grid w-full grid-cols-[2.5rem_1fr_auto] items-start gap-y-1 pt-4.5 pb-5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-disabled:opacity-60"
                >
                  <span className="font-serif text-[15px] leading-relaxed text-muted-foreground italic tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="font-serif text-xl leading-snug font-medium tracking-[-0.01em]">
                      {document.name}
                    </span>
                    <span className="text-[13.5px] leading-normal text-ink-2">
                      {document.description}
                    </span>
                  </span>
                  <span className="self-center pl-3 text-muted-foreground transition-transform duration-200 ease-out group-hover:translate-x-0.5">
                    {picking === document.id ? (
                      <Spinner />
                    ) : (
                      <ArrowRightIcon className="size-4" aria-hidden="true" />
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-20 flex flex-col gap-6 border-t-[1.5px] border-foreground pt-10 md:mt-28 md:flex-row md:items-end md:justify-between md:gap-10 md:pt-12">
          <h2 className="font-serif text-4xl leading-none font-normal tracking-[-0.03em] md:text-[3.625rem]">
            Start with one sentence.
          </h2>
          <Button
            type="button"
            className="h-12 self-start rounded-full pr-5 pl-6 text-[15px] md:self-auto"
            onClick={() => {
              const box = deal.current
              if (!box) return
              const still = matchMedia(
                "(prefers-reduced-motion: reduce)"
              ).matches
              box.focus({ preventScroll: true })
              box.scrollIntoView({
                block: "center",
                behavior: still ? "instant" : "smooth",
              })
            }}
          >
            Start drafting, free
            <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
          </Button>
        </section>
      </div>
    </div>
  )
}
