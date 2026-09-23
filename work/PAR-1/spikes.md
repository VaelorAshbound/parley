# Spikes: PAR-1 Phase 0

> The results from T2 and T3. Checkpoint 0 decides go / no-go from these.

## T2: PDF (Browser Run) and DOCX (`docx`) on Workers

**Verdict: GO for both.** Checked locally, against real Browser Run, and deployed on `parley.vaelorashbound.workers.dev` (2026-09-23; the Worker was deleted afterwards, as agreed).

### What was built

- `apps/web/src/server/spike.ts`: `GET /api/spike/pdf` and `GET /api/spike/docx`. Both use the real Common Paper Mutual NDA standard terms (11 clauses) as the sample text.
- PDF: `env.BROWSER.quickAction("pdf", { html, cacheTTL: 0, pdfOptions: { format: "letter", margin: 1in, tagged: true } })`.
- DOCX: `Packer.toArrayBuffer(new Document(...))` with `docx` 9.7.1, US Letter.

### Tests

| Test | Where | Result |
|---|---|---|
| `spike-docx.test.ts` | workerd, offline (`pnpm test:workers`) | ✅ The DOCX unzips with JSZip, and `word/document.xml` holds the NDA text. |
| `spike-pdf.real.test.ts` | workerd + **real** Browser Run (`pnpm test:workers:real`) | ✅ 200, `application/pdf`, `%PDF-` … `%%EOF`, 3 `/Page` objects. |

### Measurements (2026-09-23, local dev → remote Browser Run)

| | PDF | DOCX |
|---|---|---|
| Size | 56.9 KB, 3 pages | 11.3 KB |
| Worker time (Server-Timing) | 1.05–1.63 s (includes the hop from this machine to the remote binding) | 57–68 ms |
| Browser time (`X-Browser-Ms-Used`, uncached, 6 runs) | 143–313 ms, median ≈ 195 ms | none |
| Cost | ≈ $0.000005 per PDF (0.2 s × $0.09/h). The 10 included hours ≈ 180,000 PDFs/month. | Only Worker CPU |

### Deployed (workers.dev, 2026-09-23)

| | PDF (6 runs) | DOCX (4 runs) |
|---|---|---|
| Worker time (Server-Timing) | 294–848 ms | shows 0 ms: Workers freeze `Date.now()` during CPU-only work, so only I/O moves the clock |
| Browser time (`X-Browser-Ms-Used`) | 128–329 ms | none |
| Total from this machine | 1.31–1.81 s | 0.88–0.90 s. That's about the same as `/api/health` (≈ 0.9–1.1 s round trip from here), so building the DOCX adds almost nothing. |
| Upload / startup | 377 KiB gzip, 22 ms startup (`docx` adds about 170 KiB) | |

The live files check out the same way: a 3-page tagged PDF, and a DOCX with 12 paragraphs.

### The files, checked with real tools

- **PDF** (pypdf): 3 pages, 612 × 792 pt (US Letter), **tagged** (`/StructTreeRoot`), with a title in the metadata. The text extracts cleanly with curly quotes. In Chromium's PDF viewer it looks right: a bold title, bold clause numbers, even margins.
- **DOCX** (python-docx + the docx skill's OOXML schema check): 8.5 × 11 in, 12 paragraphs (a title + 11 clauses), bold runs where expected. **All schema validations passed.**

### Things we learned (they feed T12 and T24)

1. **Fonts must be embedded.** Browser Run has no Georgia, so the PDF fell back to Liberation Serif. T12 must load the brand fonts (Newsreader, Instrument Sans) with `@font-face` in the print HTML. See https://developers.cloudflare.com/browser-run/features/custom-fonts/
2. **Turn off Browser Run's cache for exports** (`cacheTTL: 0`). The default caches each result for 5 s, and drafts are private.
3. **`quickAction()` has no local simulator.** Dev and the PDF test use `"remote": true` on the binding. The default Worker tests run with `remoteBindings: false`, so they need no login and cost nothing. Real-service tests are `*.real.test.ts`, run by `pnpm test:workers:real`.
4. **`docx` runs in workerd as it is**, with no polyfills and in about 60 ms, so there's no need for the browser-side fallback.

### Still open

- [x] Deployed check (see above).
- [ ] The spike routes are public and not rate-limited. They must be removed before launch (T12 replaces them). They are safe until then because the Worker is not deployed.
- Note: the script is `pnpm run deploy`. Plain `pnpm deploy` is a built-in pnpm command (spec §3 fixed).

## T3: the full test stack in Workers Builds

Not started. It needs the repo pushed and connected to Workers Builds (owner steps).
