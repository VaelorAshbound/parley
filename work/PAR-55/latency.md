# PAR-55: cause and latency on the final code

## Cause

The guess in the item (a lazily loaded definition chunk) was wrong. All
definitions ship in the draft route's document-view chunk.

The real cause: the `chooseDocument` tool result only invalidated the draft.
The panel kept `documentId` null until `drafts/get` answered. When the next
`updateFields` chunk arrived first, its value waited for that load's round
trip. Fix: adbe0c0 (switch the cache from the tool result), 95dd3a1 (only
when the agreement changes), 4446b6e (the title too).

## Measurement on the final code

- Code: bf07ea9 (adbe0c0 + 95dd3a1 + 9f1cbcc + 4446b6e).
- Setup: local production build (`vp build` + `vp preview`), scripted AI,
  Chromium, 1280x800, 10 runs each.
- Measured: the `updateFields` tool-output chunk reaching the browser, to its
  value in the live document (fetch tee + MutationObserver).
- Machine: quiet, load average 0.4-0.7 (no other lane running).

| drafts/get | ms, sorted |
| --- | --- |
| as is (local database) | 12.4, 12.6, 13.7, 13.9, 14.4, 15.3, 15.7, 16.1, 17.2, 21.1 |
| +300 ms (the Preview's p99 is 282 ms) | 14.2, 15.9, 16.2, 16.5, 17.3, 18.1, 18.3, 18.3, 19.6, 20.1 |

Every run is far inside spec §8's 100 ms, with or without a slow `drafts/get`.
The 110-240 ms in 95dd3a1's body were taken with 5 lanes on the machine (load
average 5-29). They came from render time under that load, not from the code.
