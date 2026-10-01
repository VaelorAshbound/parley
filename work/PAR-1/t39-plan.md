# T39 plan: README + ADRs

Accept (todo.md T39, spec §8): README with a 30-second GIF, the architecture
diagram, "how it works", the eval score, the cost per document, the test
pyramid, and a local setup in 3 commands or fewer. ADRs for every decision made.
Verify: a fresh clone runs with the 3 commands in a clean container.

## Where it stands (checked 2026-10-01)

| Thing | State |
|---|---|
| README | None. The repo is **public**. |
| ADRs | 0001–0009. Spec §8 asks for 5 named ones: server entry (0002 ✅), document engine (0003 ✅), CI (0001, 0009 ✅), **PDF through Browser Run ❌, guest auth ❌, cost limits ❌**. |
| Eval score | `evals/report.md` (2026-09-25): right agreement 100%, field values 99%, 0 invalid writes. |
| Cost per NDA | $0.0037 mean (goal < $0.02), same report. |
| Local setup | No `.dev.vars.example`. `SCRIPTED_AI` exists, so the app can run without an OpenRouter key. `pnpm db:dev` and `pnpm dev` are two commands. |

## Tasks

1. **Three ADRs**, in the existing format (`docs/adr/00NN-*.md`: Status, Context,
   Decision, Alternatives considered, Consequences):
   - 0010 PDF through Browser Run (`quickAction("pdf")`), DOCX with `docx` in the Worker. Source: spikes.md T2.
   - 0011 Guest auth: Better Auth `anonymous()` + `onLinkAccount`, Turnstile before the first message, cron purge.
   - 0012 Cost limits: four layers (OpenRouter key cap, per-user daily budget in Postgres, Rate Limiting bindings, guest creation limit per network).
   Verify: each matches the code (file paths and numbers checked against the source).
2. **Local setup in 3 commands.** Add `apps/web/.dev.vars.example` (Turnstile test
   keys, `SCRIPTED_AI=1`, no real secrets) and one `pnpm setup` script if needed,
   so the README says: `git clone` → `pnpm install` → `pnpm dev` (or with `pnpm setup`).
   Verify: fresh clone in a clean podman container (Node + pnpm), home page loads
   and a scripted chat turn fills a draft.
3. **Architecture diagram** `docs/architecture.svg` (light + dark through
   `<picture>`), skill `artifact-diagramming`. One Worker → Hono / Start, Neon via
   Hyperdrive, OpenRouter, Browser Run, Resend, Polar, Turnstile, cron.
4. **30-second GIF** `docs/demo.gif`: a Playwright script on production. A guest
   asks for an NDA, the draft fills live, sign-in, PDF. Video → ffmpeg → GIF
   (under ~8 MB). One real model run, about $0.004.
5. **README.md**: one-paragraph pitch + live link, GIF, how it works, the
   architecture diagram, eval score and cost tables (from the report), the test
   pyramid (with real counts), local setup, commands, ADR index, stack.
   Verify: renders on GitHub (light + dark), all links resolve.

Commits per task: `docs(PAR-1): …`. Docs only, so no PR gate is needed; the
branch goes to `main` through a PR at the end (production deploys from `main`).
