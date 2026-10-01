import { cn } from "@workspace/ui/lib/utils"
import { CheckIcon, PenLineIcon, Undo2Icon } from "lucide-react"
import type { ReactNode } from "react"

// The start page's picture of the product (brand.md canvas, Main): a filled
// NDA cover page on a fan of other agreements, your first message, and the
// change it made. It plays one reveal on load and never loops (brand.md →
// Motion): the sheets fan out, the message pops in, Purpose inks in, then
// its change marker appears. Pure decoration, so screen readers skip it.

export function HeroArt({ className }: { className?: string }) {
  return (
    <div
      data-slot="hero-art"
      aria-hidden="true"
      className={cn("relative h-165 select-none", className)}
    >
      <div className="absolute top-5.5 left-34 rotate-4">
        <BackSheet
          className="hero-fan-r"
          title="Pilot Agreement"
          align="right"
          rules={3}
        />
      </div>
      <div className="absolute top-14.5 left-4.5 -rotate-5">
        <BackSheet
          className="hero-fan-l"
          title="Cloud Service Agreement"
          rules={2}
        />
      </div>

      <div className="hero-rise absolute top-9 left-17.5 w-113 rounded-[4px] bg-sheet px-9 pt-9 pb-7.5 font-serif text-foreground shadow-sheet">
        <div className="flex justify-between font-sans text-[9.5px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          <span>Cover Page</span>
          <span>Common Paper · v1.0</span>
        </div>
        <div className="mt-3 text-[22px] leading-[1.15] font-medium tracking-[-0.012em]">
          Mutual Non-Disclosure Agreement
        </div>
        <div className="mt-4.5 border-t-[1.5px] border-foreground text-[13px] leading-normal">
          <Row label="Purpose">
            <span className="hero-ink text-blue-ink">
              Evaluating whether to enter into a manufacturing partnership with
              the other party.
            </span>
          </Row>
          <Row label="Effective Date">
            <span className="text-blue-ink">September 23, 2026</span>
          </Row>
          <Row label="MNDA Term">
            <span className="flex flex-col gap-1.5">
              <span className="flex gap-2">
                <span className="mt-0.75 grid size-3 shrink-0 place-items-center rounded-[3px] bg-blue-ink text-on-blue">
                  <CheckIcon className="size-2.25" strokeWidth={3.5} />
                </span>
                <span>
                  Expires <span className="text-blue-ink">2 years</span> from
                  Effective Date.
                </span>
              </span>
              <span className="flex gap-2 opacity-42">
                <span className="mt-0.75 size-3 shrink-0 rounded-[3px] border-[1.25px] border-muted-foreground" />
                <span>Continues until terminated.</span>
              </span>
            </span>
          </Row>
          <Row label="Governing Law">
            <span className="rounded-[5px] border border-dashed border-empty-border bg-empty px-1.75 py-px font-sans text-[11.5px] text-muted-foreground">
              State
            </span>
          </Row>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-x-4 text-[13px]">
          <Party label="Party 1" name="Acme Robotics, Inc." />
          <Party label="Party 2" name="Northwind Labs LLC" />
        </div>
      </div>

      <div className="hero-pop absolute top-49 -left-8.5 max-w-61 rounded-[18px_18px_18px_6px] bg-bubble px-3.75 py-2.75 text-sm leading-[1.45] shadow-float [--hero-delay:900ms]">
        We’re sharing our roadmap with a manufacturing partner.
      </div>

      <div className="hero-pop absolute top-143.5 left-68 flex h-10.5 items-center gap-2.25 rounded-xl border bg-card pr-1.5 pl-3.5 text-[13px] whitespace-nowrap shadow-float [--hero-delay:2300ms]">
        <PenLineIcon className="size-3.5 text-muted-foreground" />
        <span className="text-ink-2">Purpose</span>
        <span className="text-ink-4">→</span>
        <span className="font-serif text-[14.5px] text-blue-ink">
          Evaluating a partnership
        </span>
        <span className="flex h-7 items-center gap-1 px-2 text-xs font-medium text-ink-2">
          <Undo2Icon className="size-3" />
          Undo
        </span>
      </div>
    </div>
  )
}

function BackSheet({
  className,
  title,
  align = "left",
  rules,
}: {
  className: string
  title: string
  align?: "left" | "right"
  rules: number
}) {
  return (
    <div
      className={cn(
        "flex h-137 w-105 flex-col gap-3 rounded-[4px] bg-sheet p-8.5 shadow-float ring-1 ring-foreground/5",
        className
      )}
    >
      <span
        className={cn(
          "text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase",
          align === "right" && "text-right"
        )}
      >
        {title}
      </span>
      <span className="mt-15 h-[1.5px] bg-foreground" />
      {Array.from({ length: rules }, (_, index) => (
        <span key={index} className="mt-7.5 h-px bg-rule-sheet" />
      ))}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-x-4 border-b border-rule-sheet py-3">
      <span className="pt-0.5 font-sans text-[11px] font-semibold">
        {label}
      </span>
      <span>{children}</span>
    </div>
  )
}

function Party({ label, name }: { label: string; name: string }) {
  return (
    <div className="flex flex-col gap-1.5 border-t-[1.5px] border-foreground pt-2">
      <span className="font-sans text-[9.5px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </span>
      <span className="text-blue-ink">{name}</span>
      <span className="h-6.5 border-b border-rule-sheet" />
    </div>
  )
}
