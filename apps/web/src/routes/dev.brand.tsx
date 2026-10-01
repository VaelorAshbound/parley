import { createFileRoute, notFound } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"

import { Logo, LogoMark } from "@/components/logo"
import { useTheme } from "@/components/theme-provider"

// A dev-only page that shows the Paper & Ink tokens (brand.md) in the real
// theme, so a change to globals.css can be checked in light and dark at once.
export const Route = createFileRoute("/dev/brand")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  head: () => ({ meta: [{ title: "Brand · Parley" }] }),
  component: BrandPage,
})

const surfaces = [
  ["paper", "bg-background"],
  ["paper-deep", "bg-paper-deep"],
  ["sidebar", "bg-sidebar"],
  ["surface", "bg-card"],
  ["sheet", "bg-sheet"],
  ["bubble", "bg-bubble"],
  ["hover", "bg-accent"],
  ["active", "bg-sidebar-accent"],
  ["empty", "bg-empty"],
] as const

const inks = [
  ["ink", "bg-foreground"],
  ["ink-2", "bg-ink-2"],
  ["ink-3", "bg-ink-3"],
  ["ink-4", "bg-ink-4"],
  ["rule", "bg-border"],
  ["rule-strong", "bg-input"],
  ["blue-ink", "bg-blue-ink"],
  ["blue-tint", "bg-blue-tint"],
  ["blue-border", "bg-blue-border"],
  ["highlighter", "bg-highlighter"],
  ["highlighter-soft", "bg-highlighter-soft"],
  ["destructive", "bg-destructive"],
] as const

const typeScale = [
  ["Display", "font-serif text-display", "Draft it by talking"],
  ["Title", "font-serif text-title", "Mutual NDA"],
  ["Question", "font-serif text-question", "What is the purpose?"],
  [
    "Contract",
    "font-serif text-contract",
    "Each party may disclose Confidential Information to the other.",
  ],
  ["Body", "text-body", "Parley fills in the cover page as you chat."],
  ["Small", "text-small", "Cover page by Parley, not by Common Paper."],
  ["Label", "text-label uppercase", "Governing law"],
] as const

function BrandPage() {
  const { theme, setTheme } = useTheme()

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-16 px-6 py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl">
          <Logo />
          <span className="sr-only"> brand preview</span>
        </h1>
        <ToggleGroup
          aria-label="Theme"
          variant="outline"
          value={[theme]}
          onValueChange={([next]) => {
            if (next === "light" || next === "dark" || next === "system")
              setTheme(next)
          }}
        >
          <ToggleGroupItem value="light">Light</ToggleGroupItem>
          <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
          <ToggleGroupItem value="system">System</ToggleGroupItem>
        </ToggleGroup>
      </header>

      <Section title="Logo">
        <div className="flex flex-wrap items-end gap-8">
          <LogoMark className="size-6" />
          <LogoMark className="size-12" />
          <LogoMark className="size-24" />
          <img src="/favicon.svg" alt="App icon" className="size-16" />
          <span className="text-title">
            <Logo />
          </span>
        </div>
      </Section>

      <Section title="Color">
        <Swatches items={surfaces} />
        <Swatches items={inks} />
      </Section>

      <Section title="Type">
        <dl className="flex flex-col gap-6">
          {typeScale.map(([name, className, sample]) => (
            <div
              key={name}
              className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:items-baseline"
            >
              <dt className="text-small text-muted-foreground">{name}</dt>
              <dd className={className}>{sample}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="A field's life">
        <div className="bg-paper-deep p-6 sm:p-10">
          <article className="mx-auto max-w-xl bg-sheet p-8 font-serif text-contract shadow-sheet">
            <p>
              Governed by the laws of the State of{" "}
              <span className="rounded-sm border border-dashed border-empty-border bg-empty px-1 font-sans text-small text-muted-foreground">
                State
              </span>
              .
            </p>
            <p className="mt-3 rounded-md border border-dashed border-blue-border bg-blue-tint px-2 py-1">
              Purpose: to discuss a possible partnership.
            </p>
            <p className="mt-3">
              The MNDA Term is{" "}
              <span className="rounded-sm bg-highlighter px-0.5 text-blue-ink">
                2 years
              </span>{" "}
              and settles to{" "}
              <span className="rounded-sm bg-highlighter-soft px-0.5 text-blue-ink">
                2 years
              </span>
              , then plain <span className="text-blue-ink">Acme, Inc.</span>
            </p>
          </article>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-3">
          <Button>Export PDF</Button>
          <Button variant="secondary">Share</Button>
          <Button variant="outline">Rename</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="destructive">Delete</Button>
          <Button variant="link">Learn more</Button>
        </div>
      </Section>

      <Section title="Motion">
        <output className="shimmer text-body text-muted-foreground">
          Updating the document…
        </output>
      </Section>
    </main>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-label text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  )
}

function Swatches({
  items,
}: {
  items: ReadonlyArray<readonly [name: string, className: string]>
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {items.map(([name, className]) => (
        <li key={name} className="flex flex-col gap-2">
          <span
            className={cn("h-14 rounded-lg ring-1 ring-border", className)}
          />
          <span className="text-small">{name}</span>
        </li>
      ))}
    </ul>
  )
}
