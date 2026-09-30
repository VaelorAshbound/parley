---
id: PAR-45
title: >-
  Design and feel notes from T36 QA (dark highlighter, 2560 layout, auth pages,
  pricing in dark, editor frame)
phase: done
priority: low
origin: PAR-1
created: 2026-09-30T15:59:46Z
updated: 2026-09-30T20:31:07Z
---

Found in T36 (exploratory QA on the Preview, 2026-09-30). These are design and feel notes, not bugs. The owner picks which to do. Report: work/PAR-1/qa.md.

## journeys

- The start page is stunning at 1440 light and dark. The hero reveal replays on every visit to / (after New draft, after a delete) and is mid-animation when you land there. In the hero art, the chat bubble covers the 'Effective Date' label, so the date row looks unlabeled (04-start-1440-light.png, 66-delete-confirm.png).
- With the sidebar open (any guest with a draft, every signed-in user) the headline wraps to 4 lines and the hero art shrinks to 0.72 with tiny text and empty space below (41-forward.png, 47-signed-in.png).
- Accessible names run words together: h1 'Watch the contractfill itself in.', h2 'Eleven agreements.One conversation.', composer group 'Enterto startStart drafting' (a <br>/span with no space).
- Real model feel: the first answer was excellent (picked the NDA with a one-line reason; set Purpose, both parties). But it then asked 4 + 5 questions in two sets, which strains the '2-minute NDA'. The governing-law step offers both 'E Another state — Type the state' and the 'Something else…' box (redundant).
- On the optional last step, 'Send answers' with an empty box shows an error ('Choose an answer or skip this question') where it could just send as a skip.
- 'Fill in Party 2 first' (PDF guard) is a good message, but it doesn't scroll to or open the Party 2 field. The 'Word files come with Pro' notice stays pinned over the top of the document through later actions until closed by hand.
- The offline failure says 'Parley couldn't answer. Please try again.' It could say you're offline and retry by itself when back online.
- 'Stop sharing' acts at once with no confirm and no Undo in its toast. Fine for now, but old recipients lose access for good (a new link has a new token).
- Drafts with no agreement are all titled 'New draft' with type 'New draft', so history and search show several identical 'New draft' rows. The browser tab title is always 'Draft · Parley', never the draft name.
- The 404 pages (/d/<unknown uuid>, unknown route) drop the app shell and sidebar entirely (only a 'Start a new draft' button). The /s/ not-found page keeps a header and is nicer.
- A guest who clicks a library item far down the page gets scrolled back to the top notice ('Guests keep one draft…'). It works, but it jumps.
- The first scripted reply on a newly signed-in account's first starter took more than 6 s with no visible 'Thinking…' in the screenshot. I could not reproduce it: later starters showed 'Thinking…' and replied in about 1-2 s. Likely a cold start.
- Share page, PDF and dark theme look professional. Security headers on /s/ are right (noindex, no-store, no-referrer). Rename escapes HTML. Delete-with-Undo works and commits on toast close. Undo marks superseded changes 'Changed since': a nice touch.

## sizes-feel

- Start page (light, 1440): at Linear/Apple level. The big Newsreader headline, the blue italic 'fill itself in.' on the yellow highlighter, the paper-and-ink colors and the fanned NDA art all read as one crafted system. In dark mode the highlighter under the headline turns a muddy olive (#4B3F14) and looks dirty next to the lavender italic. Consider a lower-alpha yellow or a thin underline in dark.
- 2560x1440: the start hero is capped to the left, with about 1,000px of empty paper to the right of the art, while the library below spans the full width. The page looks left-heavy. The draft at 2560 puts a ~550px sheet in a ~1,280px panel with 14.5px contract text. Consider a max-width for the whole landing, and a larger sheet (or bigger contract type) on very wide screens.
- At 1024 and 1180 with the sidebar open, the hero art is hidden (container query), so the right half of the start page is empty paper. The layout is fine, but the product picture is gone just where a laptop user first lands.
- At 768 with the sidebar open, the document closes by itself (chat min 360 + doc min 420 do not fit). On a tablet the side-by-side view, which is the wow moment, needs the sidebar collapsed first. Consider collapsing the sidebar by default below about 1100px on a draft.
- Pricing in dark mode: in light the Pro card is inverted (ink), which makes it the obvious pick. In dark both cards are the same surface, so Pro loses its emphasis. Give Pro a blue-tint border or a lighter surface in dark.
- Sign-in, sign-up, verify-email and Settings look like stock shadcn cards compared with the start and pricing pages: plain white cards, a heavy all-black button style, uneven bottom padding on 'Check your inbox'. They work, but they don't carry the Paper & Ink craft yet. Examples: set the card title in Newsreader at Title size, use more air, and use the ink button only once per page.
- Unchosen option lines in the document use 85% opacity, not the 42% brand.md says. This is probably on purpose for contrast; if so, update brand.md so the spec and the build agree.
- The inline field editor draws a double frame (the blue 'editing' frame plus the textarea's own ring) and uses sans-serif text inside a serif contract. Brand.md describes a single 1.5px border with a 3px halo.
- Guest Share menu offers 'Copy link', and only after you click it does a toast say to create an account. Showing 'Create a free account to share' in the menu itself would be more honest and saves a click.
- Phone document bar (frosted Share + Download) looks good and clears the content. The phone chat header uses two rows (tabs, then the title) before any content. At 375x667 with the composer, only about 250px is left for messages.
- Reduced motion is done well: every sweep, fan and pop becomes an opacity fade, and the shimmer or ink settle does not loop.
- Focus rings: all controls show a visible blue ring (checked with a screenshot of a chip). The questionnaire's text input shows the ring on its wrapper. Good.

## account-memory

- Memory result: no leak. One Free chat, scripted AI, forced GC before each reading. User messages 1 / 24 / 49 / 74 / 99 (the 100th was refused by the limit): used JS heap 39.70 / 40.75 / 41.37 / 42.00 / 42.21 MB; DOM nodes (Memory.getDOMCounters) 2768 / 3161 / 3588 / 4015 / 4442; elements 460 / 759 / 1084 / 1409 / 1734; JS event listeners flat at 2902; documents flat at 7. Growth is linear and small (~26 KB heap and ~17 DOM nodes per message, the bubbles themselves), no retained listeners or detached documents. Scroll over the whole chat: p50/p95/max frame 16.7/16.7/16.8 ms at every checkpoint, no jank. Keypress to second frame: ~33 ms (two rAFs), the same at 1 and 99 messages. Server reply each turn ~750 ms. Raw log: qa/account-memory/mem.log; script: memtest.mjs.
- Input events are fairly heavy but don't grow: keydown/keyup/beforeinput/input often take 16–96 ms (Event Timing, 483 entries >=16 ms over ~100 typed messages via Input.insertText; max 96 ms, the same max at 24 and 99 messages). It could be worth profiling the composer's per-keystroke work (React Compiler should keep the message list out of it).
- The sign-in submit button's accessible name is 'Sign in Last used' because the 'Last used' badge is inside it; screen readers read both. The badge also pushes the button label left-aligned, while other auth forms have centered labels (13-wrong-password.png).
- Sign-up with a short password shows the hint 'At least 10 characters.' and, right under it, the error 'Use at least 10 characters.': the same line twice (04-sign-up-validation.png). Could replace the hint with the error.
- An expired or used reset link reads 'This link has expired or was already used. Ask for a new one. Ask for a new link': the sentence and the link say the same thing (36-reset-reuse.png).
- The delete-account dialog for a Pro user says nothing about the subscription; one line like 'Your Pro plan is canceled too' would reassure (the code does cancel it in beforeDelete).
- The refused message is shown in the chat but not saved: after a reload the refused text is gone. It might be worth keeping it in the composer so the user can resend once the limit resets or after upgrading.
- The account's daily count includes the guest's messages from before sign-up (the limit hit at 99 new + 1 guest). That seems intended ('Your draft comes with you') but isn't stated anywhere.
- Well made: the verify-first gate on export, the 2FA flow (QR + manual key, segmented OTP input, backup-code paste handling the dash), the Pro success banner and the instant Free→Pro badge change, the clear limit notices with the right CTA for guest vs Free. Auth pages look calm and on-brand in dark and light at 375 px.

Done when: the owner has chosen which notes to do, and those are done or filed separately.
