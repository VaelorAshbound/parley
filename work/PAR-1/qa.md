# T36 Exploratory QA

Date: 2026-09-30. Target: the Preview `https://par-1-parley-parley.vaelorashbound.workers.dev`
at c77bbae (the same app code as 217b041). Run as a workflow wave with 3 QA agents
(`waves/wave-t36.js`); the PAR-29 and PAR-6 fixes ran at the same time in worktrees.
Screenshots cited below are in `qa/<area>/`.

## Result

- **1 high bug:** PAR-32 (the live document sometimes misses the first change). It breaks
  the product's main "wow" moment, so Checkpoint 7 ("no open high-severity bugs") waits
  for it.
- 3 medium bugs, 9 low bugs and 1 set of design notes are filed (table below).
- **No memory leak** over a 100-message chat (numbers below).
- Two bugs QA saw are fixed in this wave: the closed document panel stayed in the Tab
  order (PAR-6 fix: a closed panel is now `display: none`), and phone drawer links left
  the drawer open (PAR-29).

## Bugs filed

| ID | Sev | What |
|---|---|---|
| PAR-32 | high | Live document keeps the template value after the first message, while the chat marker shows the AI's value (2 of 4 runs; a reload shows the right value). Likely a refetch landing after `setQueryData` in `use-document-sync.ts`. `qa/sizes-feel/draft-1440.png`, `draft-1440-reload.png` |
| PAR-33 | medium | Reload during a reply: the question stays unanswered with no status; the reply shows only after another reload. `qa/journeys/33-reload-mid.png`, `34-reload-mid-15s.png` |
| PAR-34 | medium | A send refused by the daily limit scrolls the chat to the top, so the limit notice and its CTA are ~22,000 px off screen. `qa/account-memory/15-free-limit.png`, `17-after-refused-send.png` |
| PAR-35 | medium | Questionnaire focus: a text step leaves focus on the fieldset (typed text is lost), and Send answers drops focus to `<body>`. May explain PAR-30. |
| PAR-36 | low | Not-found pages: `/d/<not a uuid>` gives HTTP 500; the 404s have no heading, landmark or title, drop the app shell, and don't offer Sign in to a signed-out owner. |
| PAR-37 | low | The composer cuts a paste at 4000 characters with no feedback. |
| PAR-38 | low | Search with no letters or digits (e.g. an emoji) lists every draft. |
| PAR-39 | low | The send guard reads render state; two sends in one task both go through (real input did not reproduce it). |
| PAR-40 | low | The PDF prints an empty optional field as its placeholder `[MNDA modifications]`. `qa/journeys/50-pdf-p1.png` |
| PAR-41 | low | Accessibility details: run-together names (h1, h2, composer group, "Sign in Last used"), an unrounded separator value, a 20 px More button, two Toggle Sidebar buttons. |
| PAR-42 | low | The change marker cuts the new value to a few characters at narrow widths, and its title is the field hint, not the value. |
| PAR-43 | low | Polar's `customer_session_token` stays in the URL and history after checkout. Fold into T38's security headers. |
| PAR-44 | low | Spec §1 gap: no "expand to full width" and no card in the chat to reopen a closed document. |
| PAR-45 | low | Design and feel notes: muddy dark-mode highlighter, left-heavy start page at 2560, auth pages look like stock shadcn, Pro card loses its emphasis in dark, double frame on the field editor, brand.md says 42 % opacity for unchosen options but the build uses 85 %. |

## Memory (100-message chat)

A Free account with scripted AI, measured over CDP with a forced GC before each reading
(`qa/account-memory/mem.log`):

| User messages | JS heap | DOM nodes | Listeners |
|---|---|---|---|
| 1 | 39.70 MB | 2768 | 2902 |
| 24 | 40.75 MB | 3161 | 2902 |
| 49 | 41.37 MB | 3588 | 2902 |
| 74 | 42.00 MB | 4015 | 2902 |
| 99 | 42.21 MB | 4442 | 2902 |

Growth is linear and small (about 26 KB and 17 nodes per message: the bubbles
themselves). The listener and document counts stay flat. Scrolling stays at 16.7 ms
frames. A keypress takes about 33 ms to reach the screen, at both 1 and 99 messages.
Input events often take 16–96 ms without growing; the composer's work per keystroke is
worth a profile later (in PAR-45's notes).

## Covered

- **Journeys** (1440/1280, light and dark): start page, a guest NDA from one sentence
  (scripted, and 2 real model messages), questionnaire, click-to-edit, Undo and
  "Changed since", Try again after an offline failure, document panel close/reopen/
  keyboard resize, PDF export and its guards, share link (headers checked, revoke),
  search, history rename/duplicate/delete+undo, edge cases (empty, 5000 characters,
  double send, reload mid-reply, back/forward, bad URLs).
- **Sizes and feel**: 8 sizes from 375 to 2560, light and dark, on every page; contrast
  in both themes (all text passes); reduced motion (matches brand.md); emulated 200 %
  zoom; the whole draft journey by keyboard; screen-reader names from snapshots.
- **Accounts**: sign-up keeps the guest draft, email verification (real Resend), the
  sign-in errors, guest (20) and Free (100) daily limits, Polar sandbox checkout to Pro
  and the billing portal, two-factor setup and the sign-in challenge with a backup code,
  password reset (real Resend), and deleting a Pro account.

## Not covered

| What | Why |
|---|---|
| The Claude in Chrome feel check (asked for by T37) | Not available to agents. Headless agent-browser screenshots were judged instead; the notes are in PAR-45. **Owner:** a short look in real Chrome. |
| Chrome DevTools MCP | Not in the session. The memory check used a CDP script instead (same data). |
| WebKit and Firefox by hand | agent-browser is Chromium only. CI runs e2e on all 6 browser projects. |
| DOCX contents, PDF pages 3–4 in detail | Word is Pro-only in the journeys area; no PDF text tool here. T31's real export test covers both. |
| Retry after a server-side failure (PAR-7) | Only an offline (client) failure could be caused. |
| Email change, trust this device, new backup codes, turning off 2FA | Email limit of 2 per area, and time. |
| Polar cancels the subscription when a Pro account is deleted | No Polar dashboard access. **Owner:** check the sandbox dashboard for the deleted QA account. |
| Google/GitHub sign-in | Previews have no OAuth apps. |

## Known items checked

- **PAR-30** (the keyboard golden path never sends): on the Preview the keyboard path
  sent the answers and got a reply, so it does not reproduce there. PAR-35's focus bug
  may be the local cause.
- **PAR-7**: the client-side retry is clean; the server-side case is still open.
- **PAR-20**: turning on 2FA still doesn't offer "Sign out other devices" (as filed). A
  password reset did end the other device's session.
- **PAR-21**: checkout and the portal work in the sandbox; none of its items came up.
- **PAR-6**: the filed symptom (a 1368 px page) did not reproduce at 217b041. The fix
  removes the shared cause (a closed panel's content laid out past the edge).

Test accounts left on the Preview: the ones the QA agents signed up
(`delivered+…@resend.dev`); the Pro one was deleted.
