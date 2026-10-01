# ADR-0010: PDF through Browser Run's PDF Quick Action, Word files built in the Worker

## Status

Accepted (spike T2, 2026-09-23; built in T12 and T24)

## Context

A finished draft downloads as a PDF (everyone with a confirmed email) or a Word file (Pro). Both must look like the preview: same text, same numbering, same brand fonts. A legal document that prints differently from what the user checked on screen is a bug they can't see.

Parley runs as one Worker (ADR-0002). A Worker has no browser and no native libraries, and the fixed cost goal is the Workers Paid plan only (spec §8). So the question was where the PDF gets drawn, and whether the Word library runs in workerd at all.

## Decision

- **One render model for every output.** The document engine (ADR-0003) turns a draft into one render model. The preview draws it in React, `toPrintHtml` turns it into a print page, and `toDocx` turns it into a Word file. No output reads the template on its own.
- **PDF: Browser Run's PDF Quick Action** (`env.BROWSER.quickAction("pdf", …)`, `src/server/files.ts`), from the print page:
  - `cacheTTL: 0`: drafts are private, so Browser Run never keeps them (its default cache is 5 s).
  - The brand fonts are embedded with `@font-face` in the print HTML (`src/server/fonts.ts`, about 300 KB, loaded on first export). Browser Run has no Georgia or brand fonts.
  - The page size and margins come from the print CSS's `@page` rule (`preferCSSPageSize`). Browser Run doesn't draw CSS page margin boxes, so Chrome's own header and footer templates carry the name and "Page 1 of 5".
  - `tagged: true`: the PDF has a structure tree for screen readers.
- **Word: the `docx` library, in the Worker** (`@workspace/documents/docx`, about 170 KB, loaded on first export). It runs in workerd as it is, in about 60 ms.
- **Failures are typed.** A non-200 from Browser Run throws `PrintFailed` with its status (429 is its rate limit), and the export is not counted (ADR-0006 counts after the file exists).
- **Tests.** The Worker tests fake the printer (`PrintPdf`), so they need no login and cost nothing. `pnpm test:workers:real` and the Real services CI job print with the real Browser Run.

## Alternatives considered

### PDF in the browser (`window.print()`)

- Pros: No server work, no cost.
- Cons: Every browser prints differently (Safari's margins, Firefox's fonts), the user picks paper size and headers in a dialog, and the server can't count the export (ADR-0006) or check the email first.
- Rejected: the PDF is the product. It must be the same file for everyone.

### A PDF library in the Worker (pdf-lib, a React-to-PDF renderer)

- Pros: No browser, no extra binding.
- Cons: A second layout engine. Line breaks, numbering indents and hyphenation would have to be redone by hand, and would drift from the HTML preview. pdf-lib has no text layout at all.
- Rejected: Chrome already lays out the print page the way the preview does.

### Puppeteer on Browser Run (a browser session)

- Pros: Full control (wait for fonts, run scripts, several pages per session).
- Cons: More code (launch, page, close, session reuse), and slower to start. The print page is static HTML, so the extra control buys nothing.
- Rejected: the Quick Action is one call for exactly this case.

### A container (Cloudflare Containers with Chromium, or an outside PDF API)

- Pros: Any tool, any font.
- Cons: A second deploy and an always-on cost (or a slow cold start), against the "only $5/month fixed" goal. An outside API also sends private drafts to another company.
- Rejected.

### Word files in the browser

- Pros: No server work.
- Cons: The `docx` library in the client bundle, and the Pro check and quota would need a second path. The T2 spike showed `docx` runs in workerd with no polyfills, so the planned fallback wasn't needed.
- Rejected.

## Consequences

- A PDF costs about $0.000005 of Browser Run time (≈ 0.2 s at $0.09/h, spike T2). The 10 included hours a month are about 180,000 PDFs. Each print takes a few seconds end to end, so downloads have their own rate limit (10 a minute per user, ADR-0012).
- `quickAction()` has no local simulator. Local dev uses `"remote": true` on the binding (wrangler.jsonc), so exporting a PDF locally needs `wrangler login`. Everything else runs offline.
- If Browser Run is down or rate limited, PDF downloads fail with a clear message and nothing is counted. Word files still work.
