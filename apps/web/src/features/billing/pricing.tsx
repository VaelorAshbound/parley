import { Link } from "@tanstack/react-router"
import { Badge } from "@workspace/ui/components/badge"
import { Button, buttonVariants } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import {
  ArrowRightIcon,
  CheckIcon,
  CircleCheckIcon,
  LockIcon,
} from "lucide-react"
import type { ReactNode } from "react"

import { ProblemNote } from "@/components/problem-note"
import { SiteFooter, SiteHeader } from "@/components/site"
import {
  DAILY_MESSAGES,
  FREE_DOCUMENTS_PER_MONTH,
  GUEST_DRAFTS,
} from "@/lib/limits"
import type { Viewer } from "@/lib/session"

import { useCheckout, usePortal, useUpgradeWait } from "./use-billing"

// Pricing (spec §2 Limits, §4 Payments; T26), after the approved design
// (brand.md canvas, Pricing): Free and Pro side by side, each button right
// for who is looking, and the questions people ask before they pay.

type Upgrade = ReturnType<typeof useUpgradeWait>

export function Pricing({
  viewer,
  checkoutId,
}: {
  viewer: Viewer
  /** Back from Polar's checkout. */
  checkoutId?: string | undefined
}) {
  const isAccount = viewer !== null && !viewer.isAnonymous
  const upgrade = useUpgradeWait(checkoutId)
  const pro = viewer?.plan === "pro" || upgrade?.state === "done"

  return (
    <div className="@container flex min-h-svh flex-col">
      <SiteHeader isAccount={isAccount}>
        <Link
          to="/"
          className={cn(
            buttonVariants(),
            "ml-1 hidden h-9 px-4 sm:inline-flex"
          )}
        >
          Start drafting
        </Link>
      </SiteHeader>
      <main className="flex w-full flex-1 flex-col px-6 pt-10 pb-10 md:px-12 md:pt-16 @min-[84rem]:pr-14 @min-[84rem]:pl-23">
        <section className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Pricing
          </p>
          <h1 className="mt-3 font-serif text-[2.75rem] leading-[1.02] font-normal tracking-[-0.03em] text-balance md:text-6xl lg:text-7xl lg:leading-[0.98]">
            Free to draft.
            <br />
            <em className="text-blue-ink">$5</em> when you need more.
          </h1>
          <p className="mt-6 max-w-[34rem] text-lg leading-[1.55] text-pretty text-ink-2">
            Every plan uses the same eleven Common Paper agreements. Pro adds
            unlimited documents and Word files.
          </p>
          {!isAccount && (
            <Link
              to="/"
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-foreground"
            >
              No account? Start a draft now: {GUEST_DRAFTS} draft,{" "}
              {DAILY_MESSAGES.guest} messages a day.
              <ArrowRightIcon className="size-3.5" aria-hidden="true" />
            </Link>
          )}
        </section>

        {upgrade && <UpgradeStatus upgrade={upgrade} />}

        <section
          aria-label="Plans"
          className="mx-auto mt-12 grid w-full max-w-[56.5rem] gap-6 md:grid-cols-2"
        >
          <PlanCard
            name="Free"
            tagline="For the occasional agreement."
            price="$0"
            per="forever"
            current={isAccount && !pro}
            action={<FreeAction isAccount={isAccount} pro={pro} />}
            features={[
              `${FREE_DOCUMENTS_PER_MONTH} finished documents a month`,
              "PDF download",
              `${DAILY_MESSAGES.free} AI messages a day`,
              "Saved drafts, search and share links",
            ]}
          />
          <PlanCard
            featured
            name="Pro"
            tagline="For people who draft every week."
            price="$5"
            per="a month"
            current={pro}
            action={<ProAction isAccount={isAccount} pro={pro} />}
            features={[
              "Unlimited documents",
              "PDF and Word (DOCX)",
              `${DAILY_MESSAGES.pro} AI messages a day`,
              "Everything in Free",
            ]}
          />
        </section>
        <p className="mt-6 flex items-center justify-center gap-2 text-center text-[13px] text-muted-foreground">
          <LockIcon className="size-3.5 shrink-0" aria-hidden="true" />
          Checkout runs in Polar’s sandbox for this demo. No real card is
          charged.
        </p>

        <Questions />

        <SiteFooter isAccount={isAccount} />
      </main>
    </div>
  )
}

function PlanCard({
  name,
  tagline,
  price,
  per,
  current,
  action,
  features,
  featured = false,
}: {
  name: string
  tagline: string
  price: string
  per: string
  current: boolean
  action: ReactNode
  features: string[]
  featured?: boolean
}) {
  return (
    <article
      aria-labelledby={`plan-${name}`}
      className={cn(
        "flex flex-col rounded-2xl border p-8",
        featured
          ? // A dark island on a light page; on a dark page, a raised card.
            "dark border-transparent bg-background text-foreground shadow-float dark:border-border dark:bg-card"
          : "bg-card"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={`plan-${name}`} className="text-base font-semibold">
            {name}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{tagline}</p>
        </div>
        {current && <Badge variant="secondary">Your plan</Badge>}
      </div>
      <p className="mt-6 flex items-baseline gap-2">
        <span className="font-serif text-6xl leading-none tracking-[-0.03em]">
          {price}
        </span>
        <span className="text-sm text-muted-foreground">{per}</span>
      </p>
      <div className="mt-8">{action}</div>
      <ul className="mt-7 flex flex-col gap-3.5 border-t pt-7 text-[15px]">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-3">
            <CheckIcon
              className="size-4.5 shrink-0 text-blue-ink"
              strokeWidth={2}
              aria-hidden="true"
            />
            {feature}
          </li>
        ))}
      </ul>
    </article>
  )
}

const wide = "h-11 w-full"

function FreeAction({ isAccount, pro }: { isAccount: boolean; pro: boolean }) {
  if (!isAccount)
    return (
      <Link
        to="/sign-up"
        search={{ redirect: "/pricing" }}
        className={cn(buttonVariants({ variant: "outline" }), wide)}
      >
        Create a free account
      </Link>
    )
  return (
    <Link to="/" className={cn(buttonVariants({ variant: "outline" }), wide)}>
      {pro ? "Start drafting" : "Keep drafting"}
    </Link>
  )
}

function ProAction({ isAccount, pro }: { isAccount: boolean; pro: boolean }) {
  // Checkout is for accounts: sign up first, then come back here.
  if (!isAccount)
    return (
      <Link
        to="/sign-up"
        search={{ redirect: "/pricing" }}
        className={cn(buttonVariants({ variant: "secondary" }), wide)}
      >
        Upgrade to Pro
      </Link>
    )
  return pro ? <ManageBilling /> : <Upgrade />
}

function Upgrade() {
  const checkout = useCheckout()
  return (
    <PolarButton
      label="Upgrade to Pro"
      pendingLabel="Opening checkout…"
      {...checkout}
    />
  )
}

function ManageBilling() {
  const portal = usePortal()
  return (
    <PolarButton
      label="Manage billing"
      pendingLabel="Opening billing…"
      {...portal}
    />
  )
}

function PolarButton({
  label,
  pendingLabel,
  open,
  pending,
  problem,
}: {
  label: string
  pendingLabel: string
} & ReturnType<typeof useCheckout>) {
  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="secondary"
        className={wide}
        disabled={pending}
        onClick={open}
      >
        {pending && <Spinner data-icon="inline-start" />}
        {pending ? pendingLabel : label}
      </Button>
      {problem && !pending && (
        <ProblemNote problem={problem} className="text-left" />
      )}
    </div>
  )
}

/** Back from Polar's checkout: Pro turns on when its webhook arrives. */
function UpgradeStatus({ upgrade }: { upgrade: NonNullable<Upgrade> }) {
  return (
    // <output> is a live status region: each step is read out.
    <output className="mx-auto mt-10 flex w-full max-w-[56.5rem] items-center gap-3 rounded-xl border bg-card px-5 py-4 text-[15px]">
      {upgrade.state === "done" ? (
        <>
          <CircleCheckIcon
            className="size-5 shrink-0 text-blue-ink"
            aria-hidden="true"
          />
          <span className="flex-1">
            You’re on Pro. Word files and unlimited documents are ready.
          </span>
          <Link
            to="/"
            className={cn(buttonVariants({ size: "sm" }), "shrink-0")}
          >
            Start drafting
          </Link>
        </>
      ) : upgrade.state === "waiting" ? (
        <>
          <Spinner className="size-5 shrink-0" />
          <span className="flex-1">Thanks! Turning on Pro…</span>
        </>
      ) : (
        <>
          <Spinner className="size-5 shrink-0 opacity-0" />
          <span className="flex-1">
            Polar is still confirming your payment. Pro turns on by itself, so
            you can keep working.
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={upgrade.again}
          >
            Check again
          </Button>
        </>
      )}
    </output>
  )
}

const questions = [
  {
    q: "What counts as a document?",
    a: "A document counts the first time you download it. Downloading it again is always free, and drafts you never download don’t count.",
  },
  {
    q: "Is this legal advice?",
    a: "No. Parley fills in Common Paper’s standard agreements and explains them in plain words. For anything important, ask a lawyer to review it.",
  },
  {
    q: "Where do the agreements come from?",
    a: "From Common Paper, used under CC BY 4.0. Their standard terms are never changed. Cover pages for documents other than the NDA are written by Parley and labeled that way.",
  },
  {
    q: "How do I cancel?",
    a: "Open Billing from your account menu and cancel there. Pro stays on until the end of the month you paid for.",
  },
]

function Questions() {
  return (
    <section
      aria-labelledby="questions"
      className="mx-auto mt-24 grid w-full max-w-[56.5rem] gap-8 md:grid-cols-[1fr_1.8fr] md:gap-10"
    >
      <h2
        id="questions"
        className="font-serif text-4xl font-normal tracking-[-0.02em]"
      >
        Questions
      </h2>
      <dl className="flex flex-col">
        {questions.map(({ q, a }) => (
          <div key={q} className="border-b py-6 first:pt-0 last:border-b-0">
            <dt className="font-serif text-xl tracking-[-0.01em]">{q}</dt>
            <dd className="mt-3 text-[15px] leading-relaxed text-ink-2">{a}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
