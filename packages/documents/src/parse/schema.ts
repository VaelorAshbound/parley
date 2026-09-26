import { z } from "../zod.ts"

// The typed tree a Common Paper template is parsed into at build time
// (spec §2 → Document engine). The app renders from it and never parses
// markdown at runtime.

/** Where a linked term is filled in, from the template's `*_link` span class. */
export const linkKind = z.enum([
  "coverpage",
  "keyterms",
  "orderform",
  "sow",
  "businessterms",
])
export type LinkKind = z.infer<typeof linkKind>

const text = z.object({ type: z.literal("text"), value: z.string() })

/**
 * A variable in the standard terms. `term` is the canonical name ("Customer");
 * `text` is the words as written ("Customer’s"), so the renderer can keep the
 * possessive after the value.
 */
const linkedTerm = z.object({
  type: z.literal("linkedTerm"),
  kind: linkKind,
  term: z.string().min(1),
  text: z.string().min(1),
})

/** An inline hint, from the cover page's `<label>`. */
const hint = z.object({ type: z.literal("hint"), value: z.string() })

const strong = z.object({
  type: z.literal("strong"),
  get children(): z.ZodArray<typeof inline> {
    return z.array(inline)
  },
})

/** A bold, quoted term the template defines, like **"Usage Data"**. */
const definition = z.object({
  type: z.literal("definition"),
  term: z.string().min(1),
  get children(): z.ZodArray<typeof inline> {
    return z.array(inline)
  },
})

const link = z.object({
  type: z.literal("link"),
  // Links in a contract: https only, never javascript: or data:.
  href: z.url({ protocol: /^https$/ }),
  get children(): z.ZodArray<typeof inline> {
    return z.array(inline)
  },
})

export const inline = z.discriminatedUnion("type", [
  text,
  linkedTerm,
  hint,
  strong,
  definition,
  link,
])
export type Inline = z.infer<typeof inline>

/**
 * A numbered item of the standard terms. `id` is its number path from the
 * list markers ("5.3", "5.3.a", "4.2.c.i"). `heading` is the clause's bold
 * lead-in, like "Termination.", when it has one.
 */
const clause = z.object({
  type: z.literal("clause"),
  id: z.string().regex(/^\d+(\.[\da-z]+)*$/),
  heading: z.string().min(1).optional(),
  content: z.array(inline),
  get children(): z.ZodArray<typeof clause> {
    return z.array(clause)
  },
})
export type Clause = z.infer<typeof clause>

/** A top-level heading item, like "5. Term & Termination". */
const section = z.object({
  type: z.literal("section"),
  id: z.string().regex(/^\d+$/),
  heading: z.string().min(1),
  children: z.array(clause),
})
export type Section = z.infer<typeof section>

const paragraph = z.object({
  type: z.literal("paragraph"),
  content: z.array(inline),
})

export const standardTerms = z.object({
  type: z.literal("standardTerms"),
  title: z.string().min(1),
  children: z.array(z.discriminatedUnion("type", [section, clause, paragraph])),
})
export type StandardTerms = z.infer<typeof standardTerms>

/** One checkbox line of a cover page choice, like "[x] Expires …". */
const option = z.object({ checked: z.boolean(), content: z.array(inline) })

const coverBlock = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("heading"),
    depth: z.int().min(1).max(3),
    text: z.string().min(1),
  }),
  paragraph,
  z.object({ type: z.literal("options"), items: z.array(option).min(1) }),
  z.object({
    type: z.literal("table"),
    rows: z.array(z.array(z.array(inline))).min(1),
  }),
])
export type CoverBlock = z.infer<typeof coverBlock>

/** The official Mutual NDA cover page, kept as plain markdown blocks. */
export const coverPage = z.object({
  type: z.literal("coverPage"),
  children: z.array(coverBlock),
})
export type CoverPage = z.infer<typeof coverPage>
