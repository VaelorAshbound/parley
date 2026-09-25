import { Link } from "@tanstack/react-router"
import {
  DISCLAIMER,
  definitionOf,
  render,
  type DocumentId,
} from "@workspace/documents"
import { Badge } from "@workspace/ui/components/badge"
import { buttonVariants } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@workspace/ui/components/empty"
import type { ReactNode } from "react"

import { Logo } from "@/components/logo"
import { DocumentView } from "@/features/document-preview/document-view"
import { documentName } from "@/lib/documents"

// The public page of a share link (/s/:token, spec §5 Routing; T25): the
// draft's document, read-only, outside the app shell. It knows only what
// share.view sends (title, agreement, values): nothing about the owner, the
// chat or other drafts. Every page says Parley is a demo and credits Common
// Paper (spec §7), and invites the reader to draft their own.

export type Shared = {
  title: string
  documentId: DocumentId
  values: Record<string, unknown>
}

function DraftYourOwn({ size }: { size?: "sm" }) {
  return (
    <Link to="/" className={buttonVariants({ size })}>
      Draft your own
    </Link>
  )
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-paper-deep">
      <header className="flex h-14 shrink-0 items-center gap-3 px-4 md:px-6">
        <Link
          to="/"
          aria-label="Parley home"
          className="rounded-md text-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Logo />
        </Link>
        <span className="flex-1" />
        <DraftYourOwn size="sm" />
      </header>
      {children}
      <footer className="mx-auto flex max-w-[552px] flex-col gap-1 px-4 pb-10 text-center text-[12.5px] text-muted-foreground">
        <p>{DISCLAIMER}</p>
        <p>
          Standard terms by{" "}
          <a
            href="https://commonpaper.com/standards/"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            Common Paper
          </a>
          , used under{" "}
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            CC BY 4.0
          </a>
          .
        </p>
      </footer>
    </div>
  )
}

export function SharePage({ shared }: { shared: Shared }) {
  const definition = definitionOf(shared.documentId)
  const document = render(
    definition,
    definition.draftSchema.parse(shared.values)
  )
  return (
    <Frame>
      <main className="flex-1 px-4 pb-12 md:px-9">
        <div className="mx-auto flex max-w-[552px] flex-col gap-5">
          <div className="flex flex-col gap-1.5 pt-4 md:pt-8">
            <div className="flex items-center gap-2">
              <p className="text-sm text-ink-2">
                {documentName(shared.documentId)}
              </p>
              <Badge variant="outline">Read only</Badge>
            </div>
            <h1 className="font-serif text-2xl leading-tight font-medium tracking-[-0.012em] md:text-3xl">
              {shared.title}
            </h1>
          </div>
          <div className="rounded-sm bg-sheet px-6 py-10 shadow-sheet md:px-13 md:py-12">
            <DocumentView document={document} />
          </div>
          <section
            aria-labelledby="draft-your-own"
            className="flex flex-col items-center gap-3 py-6 text-center"
          >
            <h2 id="draft-your-own" className="font-serif text-xl font-medium">
              Need an agreement like this?
            </h2>
            <p className="max-w-sm text-sm text-ink-2">
              Tell Parley about your deal. It picks the right standard agreement
              and fills it in with you, live.
            </p>
            <DraftYourOwn />
          </section>
        </div>
      </main>
    </Frame>
  )
}

/** A link that is off, mistyped or of a deleted draft: all the same. */
export function ShareNotFound() {
  return (
    <Frame>
      <main className="flex flex-1 items-center">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>
              <h1 className="text-lg">This link doesn’t work</h1>
            </EmptyTitle>
            <EmptyDescription>
              It may have been turned off, or it wasn’t copied in full. Ask the
              person who sent it for a new one.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <DraftYourOwn />
          </EmptyContent>
        </Empty>
      </main>
    </Frame>
  )
}
