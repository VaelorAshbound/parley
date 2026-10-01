# Brief: writing a document definition (T8–T11)

You write one or more Parley document definitions. Each one mirrors Common Paper's **official cover page** for that document (owner decision, 2026-09-24, spec §1 "The 12 documents"). Work only on the files listed under "Deliverables". Do not change the engine (`packages/documents/src/{fields,fields/*,define,changes,render,output/*,parse/*}.ts`). If the engine can't express something, use the closest faithful workaround and report the gap.

## Read first

1. `packages/documents/src/definitions/mutual-nda.ts`: the reference definition. It uses the official cover page. Yours use `source: "parley"`.
2. The engine API:
   - `packages/documents/src/fields.ts` and `src/fields/*.ts`: the field kinds;
   - `src/define.ts`: `defineDocument`, `CoverSection` (with `part`, `template`, `when`, `lines`) and `SignatureRow`;
   - `src/definitions/prose.ts`: `paragraph`, `bold`, `link`.
3. Your group's research report in `work/PAR-1/cover-research/`. It holds the official rows, options, wording, defaults and source URLs.
4. The template itself in `templates/`, and its parsed outline in `packages/documents/test/__outlines__/<id>.txt`. The outline lists every linked term per clause, and every one of them must map to a field.

## Rules

- **Wording:** copy Common Paper's cover page word for word: section headings, hints, option labels, and the blanks where they put blanks. Where you must deviate, say why in the notes file.
- **Linked terms:** every linked term in the template maps to a field path. That includes plural and possessive variants ("Provider Covered Claims" and "Provider Covered Claim" both map). Party terms map to `<party>.company`. "Notice Address" maps to each party's `.notice`.
- **Extra rows:** add the rows the official page has even when no linked term points to them (the product, the fees, the services, the DPA's Annex I). `coverage()` requires every field to appear in a section, a line, a signature or a linked term.
- **"None" is an answer:** where omitting a term means "none" or "not applicable", use a choice with an explicit None option. Free text that may stay empty is `optional: true`.
- **Required fields:** a field whose blank would break the contract must be required. For example, General Cap Amount: an empty cap means unlimited liability.
- **Governing law:** use `field.jurisdiction({ … })`. Add `courts: "anywhere"` when the official page names "Chosen Courts" on its own. Map "Governing Law" → `"governingLaw"` and "Chosen Courts" → `"governingLaw.courtLocation"`. Use `usOnly: true` only when the terms say "the State of".
- **Intro paragraph** (`intro`, built with `paragraph`/`bold`/`link`), adapted from Common Paper's cover page intro under CC BY 4.0. It must:
  - bring in the Standard Terms by name, version and URL (use the version and URL the template itself cites);
  - say that the Cover Page controls over the Standard Terms;
  - state the omitted-term rule ("if the Cover Page omits or does not define a highlighted word, the default meaning will be 'none' or 'not applicable'…"), where Common Paper's page has it.
- **Footer** (`footer`), two paragraphs:
  1. `paragraph("Cover page adapted by Parley from Common Paper's ", link("<Name> cover page", "<official cover page URL>"), ", free to use under ", link("CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"), ".")`
  2. The standard terms' attribution: "Common Paper <Name> Standard Terms (Version X) free to use under CC BY 4.0." (with the CC BY link).
- **Signatures:** `signatures: [<party keys>]`. Add `signatureRows` when the official page's rows differ from the NDA's (Signature, Print Name, Title, Company, Notice Address, Date).
- **Help text:** plain English, 15 words or fewer, no legalese. Labels are sentence case ("General cap amount"); section headings keep Common Paper's case.
- **Defaults:** only where Common Paper pre-marks one. A choice default may be draft-shaped (`{ option: "fixed" }`, with its blank empty).
- **Units:** limit durations to the units that make sense (`units: ["days", "weeks", "months", "years"]`).
- **Style:**
  - the file is `packages/documents/src/definitions/<id>.ts` and exports `export const <camelCaseId> = defineDocument({ … })`;
  - `id` is the catalog id (`templateId` of the filename, e.g. `"csa"`, `"design-partner-agreement"`), `version: 1`, `name: catalog["<id>"].name`;
  - `template` is imported from `../../generated/<id>.ts`;
  - comments only where a choice needs a *why*.

## Deliverables (per document)

1. `packages/documents/src/definitions/<id>.ts`
2. Register it in `packages/documents/src/definitions/index.ts` (one import line and one key; keep keys in catalog order).
3. A realistic, fully filled example under the same key in `packages/documents/test/examples.ts`: fictional companies, `.test` emails, every required field, and chosen options with their blanks filled.
4. `work/PAR-1/cover-pages/<id>.md`: the sources you checked (URLs), every judgment call, every deviation from the official page and why, and any engine gap.

## Verify, then commit

The Worktree needs dependencies first: `pnpm install` (this also builds `generated/`).

```bash
pnpm check                 # format, lint, types
pnpm test:coverage         # every test green, 100% coverage on packages/documents/src
```

`test/definitions.test.ts` checks every registered definition:
- it covers its template (no unmapped or unknown terms, no unused fields);
- the example is complete and renders with no placeholder left;
- its defaults are valid.

It also writes HTML and DOCX snapshots to `packages/documents/test/__outputs__/<id>.*`. Read `<id>.docx.txt` to check that the printed cover page reads right.

Commit in your worktree, one commit per document:

```
feat(PAR-1): define the <Name> on Common Paper's official cover page (T8)

<2–4 lines: what the cover page holds, and the main judgment calls.>

Skills: incremental-implementation, test-driven-development, doubt-driven-development.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
```

Use T8, T9, T10 or T11 to match your group. **Final message** (≤ 250 words): your commits, the judgment calls a lawyer should look at, and any engine gaps.
