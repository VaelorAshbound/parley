# ADR-0003: A pure document engine: parsed templates, typed fields, one render model

## Status

Accepted (spec approved by the owner, 2026-09-23; built in T5–T6, 2026-09-24)

## Context

Parley fills Common Paper agreements. The chat, the live preview, the manual field editor, the undo markers, the PDF and the DOCX all read or write the same draft. The spec's rules:

- The standard terms stay word for word. Only the cover page gets values.
- Every linked term in a template must map to a field, and every field must be used.
- The AI's edits and the user's edits go through one checked path. Invalid values never reach the draft. Every AI change can be undone.
- One render model feeds the preview, the PDF and the DOCX.
- Everything runs in a 128 MB Worker isolate and in the browser, and the package has 100% line and branch coverage.

## Decision

`packages/documents` is pure TypeScript with no I/O at runtime. It has four parts.

1. **Parsed templates.** At build time (`pnpm documents:build`, and on install), a strict parser turns each template into a typed tree: sections, numbered clauses, inline text, linked terms and definitions. It writes typed modules to `generated/`, so the app never parses markdown. A line parser reads the clause structure, because CommonMark has no `a.`/`i.` lists. remark + rehype-raw read the text inside each line, and the whole NDA cover page.
2. **Fields.** `field.text`, `longText`, `date`, `duration`, `money`, `percent`, `choice`, `jurisdiction` and `party`. Each field has three Zod schemas, and all three carry its label and help in `.meta()`:
   - complete (for export),
   - draft (while filling in),
   - change (one edit; for object fields a partial where `null` removes a part).
3. **Definitions.** `defineDocument` ties a template to its fields: the field(s) each linked term reads, the cover page layout, cross-field rules and a `version`. It builds the document's complete, draft and change-list schemas. `coverage()` proves the template and the definition line up.
4. **Changes and rendering.**
   - `applyFieldChanges` is the only way values change. Each change is checked on its own, and it returns inverse changes for undo. Each inverse carries the value it expects to find, so an undo can't overwrite a newer edit.
   - `render` returns a `RenderedDocument`. In it, linked terms keep their words and gain their values (for the hover), and missing values become placeholders.

Before this was built, a fresh-context reviewer attacked the design (doubt-driven development). The review changed it:

- merged-value validation, so undo can clear parts;
- meta on every derived schema;
- rules kept apart from `exactPartial` (Zod throws on refined objects);
- per-currency decimals;
- dates formatted without `Date`;
- a jitless Zod entry;
- prototype-safe keys;
- compare-and-set undo.

## Alternatives considered

### Parse markdown at runtime, in the Worker

- Pros: no build step.
- Cons: remark and rehype in the Worker bundle, a parse on every cold start, and parse errors found by users instead of at build time.
- Rejected: we'd pay cost and risk for input that never changes.

### Render values inline in the standard terms

- Pros: the terms read as one filled-in text.
- Cons: it changes Common Paper's words ("use Confidential Information solely for the Evaluating whether…"), and the spec says word for word.
- Rejected: values live on the cover page; the preview shows them on hover.

### Replace-only changes (every edit sends the whole field)

- Pros: a simpler merge.
- Cons: the AI would have to resend a whole party to fix one email, and an undo could wipe parts filled later.
- Rejected: partial changes with `null` removal, plus compare-and-set undo.

### Hand-built TypeScript types beside the Zod schemas

- Pros: no type assertion anywhere.
- Cons: two sources of truth that drift.
- Rejected: types come from the schemas. The one exception is `typed()` in `src/zod.ts`: a choice's schema and a document's schemas are built at runtime from options and fields, so TypeScript can't follow them. The type tests (`test/*.test-d.ts`) prove the stated types match.

## Consequences

- One package holds all the rules for a document. The server, the AI tools and the forms import it; none of them re-validates by hand.
- Changing a field's shape needs a definition `version` bump and a migration of stored drafts (T13 stores the version).
- A new field kind (for example EU member states for the DPA) is an addition to `fields.ts`, with its own tests.
- Placeholders are plain strings in the model; each output (React, HTML, DOCX) escapes its own text (T12).

## Update: field kinds for the official cover pages (T7b, 2026-09-24)

Research found that Common Paper publishes an official cover page for every document (`work/PAR-1/cover-research/`), and the owner chose to mirror them with full fidelity. That needed more field kinds.

- **New kinds:**
  - `number`
  - `select` (EU member states)
  - `url`
  - `choices` (multi-select)
  - `list` (records, printed as a table)
  - `group` (named answers, printed as a checklist)
- **Choice options can hold several named blanks.**
- **Jurisdictions take a US state or a region,** with courts in the same place or named in full.
- **The cover page layout gains part headings, value templates, a declarative `when`, and signature rows per document.**

A second fresh-context review, of the T7b design, found 19 issues before the rest was built. The ones that changed the engine:

- each field declares whether a change merges parts or replaces the value (undo no longer guesses from its shape);
- derived parts (a party's `notice`) sit apart from stored parts;
- every value has one canonical stored shape, so no-op edits are skipped;
- blanks in a label are checked against their fields when a document is defined;
- conditions are data, not functions, so rendering can't throw;
- decimals are counted exactly.

Lists are replaced whole on change: they are short, and undo stays compare-and-set.
