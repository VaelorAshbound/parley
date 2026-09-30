---
id: PAR-34
title: >-
  Chat jumps to the top when a send is refused by the daily limit, so the limit
  notice is off screen
phase: backlog
priority: medium
origin: PAR-1
created: 2026-09-30T15:59:40Z
updated: 2026-09-30T15:59:40Z
---

Found in T36 (exploratory QA on the Preview, 2026-09-30). Report: work/PAR-1/qa.md.

### Chat jumps to the very top when a send is refused by the daily limit, so the limit notice ends up off screen
(QA area: account-memory)

- Steps: 1) Signed in (Free) or as a guest, fill a long chat (40+ bubbles) until the daily limit is reached. 2) Scroll to the end of the chat. 3) Type any message and press Enter. 4) Read the Messages viewport's scrollTop.
- Expected: The chat stays at the end and shows the refused message with the 'You've used today's N messages… Get Pro / Create an account' notice under it.
- Actual: scrollTop goes to 0 about 0.5 s after the refusal: the view jumps to the first message and the limit notice (with its upgrade CTA) is ~22,000 px below, out of view. Only 'Scroll to end' brings it back. Seen 3 times: Free account (100/day) twice and guest (20/day) once.
- Evidence: CDP polls of [data-slot=message-scroller-viewport] after Enter: {top:22174,h:22878} -> {top:0,h:22440} and it stays at 0. Screenshots: qa/account-memory/15-free-limit.png (at top after the 100th send), 17-after-refused-send.png (repro at top), 16-limit-bottom.png (the notice after pressing 'Scroll to end'), 38-guest-limit.png (the same for a guest at 20). No console errors.
- Likely file: apps/web/src/features/chat/chat-panel.tsx (ProblemNote render after a refused user message; scrollAnchor on user items) / packages/ui/src/components/message-scroller.tsx (@shadcn/react message-scroller anchoring with content-visibility:auto items)

Done when: a refused send keeps the view at the bottom with the limit notice and its CTA visible; test with a long chat.
