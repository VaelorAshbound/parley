---
id: PAR-36
title: "Not-found pages: /d/<not a uuid> gives HTTP 500; 404s have no heading, landmark or title, drop the app shell, and a signed-out owner gets no Sign in"
phase: build
priority: low
origin: PAR-1
created: 2026-09-30T15:59:40Z
updated: 2026-09-30T16:11:02Z
---

Found in T36 (exploratory QA on the Preview, 2026-09-30). Report: work/PAR-1/qa.md.

### A malformed draft URL (/d/not-a-real-id) returns HTTP 500 and 'Something went wrong… Try again' instead of not-found
(QA area: journeys)

- Steps: Open https://par-1-parley-parley.vaelorashbound.workers.dev/d/not-a-real-id and click Try again.
- Expected: The same 404 'We couldn't find that page' as /d/<unknown uuid> (which works and returns 404).
- Actual: HTTP 500. The error page says 'Your drafts are safe. Please try again.' and Try again loops to the same error. The console logs a ZodError 'Invalid UUID' three times. params.parse throws z.uuid().parse and nothing maps it to notFound().
- Evidence: curl status 500. qa/journeys/36-bad-draft-garbage.png, 39-bad-urls-grid.png. Console: 'Error: [{"origin":"string","code":"invalid_format"…"message":"Invalid UUID"}]', cause ZodError.
- Likely file: apps/web/src/routes/_app/d.$draftId.tsx:29

### 404 page has no heading or landmark, its title is just 'Parley', and it sits outside the app shell
(QA area: sizes-feel)

- Steps: Open /nope-404 at 1440 (the HTTP status is 404, which is correct).
- Expected: An h1 like 'We couldn't find that page', a <main>, a title like 'Page not found · Parley', and the shell or a logo so it feels like part of the product.
- Actual: The snapshot shows only link 'Start a new draft'. The text is a small (about 15px) serif line in the middle of an empty page. There is no logo and no nav.
- Evidence: qa/sizes-feel/nope-404-1440.png. Snapshot: '- generic - link "Start a new draft" - region "Notifications"'. get title: 'Parley'.
- Likely file: apps/web/src/routes/__root.tsx (notFoundComponent)

### A signed-out owner who opens their own draft link gets a bare 'We couldn't find that page' with no way to sign in
(QA area: account-memory)

- Steps: 1) Sign up and have a draft (/d/01a0f2d4…). 2) Sign out from the account menu. 3) Open the draft URL again (for example from a bookmark or browser history).
- Expected: Keep hiding whether the draft exists, but offer a 'Sign in' path (with redirect back to the draft) next to 'Start a new draft', since the most likely visitor is the owner.
- Actual: A full-screen 'We couldn't find that page / It may have moved, or it belongs to someone else.' with only 'Start a new draft'. No sidebar, no Sign in link.
- Evidence: qa/account-memory/12-draft-signed-out.png; the same page after account deletion: 46-deleted-draft.png
- Likely file: apps/web/src/routes/_app (draft route notFound component)

Done when: a bad draft id is a 404; the 404 pages have an h1, main landmark, a real title, the app shell where it applies, and offer Sign in when signed out.
