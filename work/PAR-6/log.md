### 2026-09-25T07:47:31Z
Created.

### 2026-09-30T16:00:55Z
Fixed in the T36 wave, merged a5b3fe7. Root cause: a closed document panel was only squeezed to 0 px; its header and px-9 scroller were still laid out past the right edge (split scrollWidth 1026 vs 1024), still in the Tab order, and scrollIntoView could slide the split sideways after an AI change. Fix: md:hidden on the panel's content when closed (display: none). Tests: e2e/no-sideways-scroll.spec.ts (1440/1280/390, open/closed, also after an AI change, reduced motion) and shell.spec checks the closed panel is not rendered. Note: the filed symptom (1368 px page) did not reproduce at 217b041; the fix removes the shared cause. Left alone: the resize grip ::after sticks out ~2 px, clipped, not scrollable. Gate: check pass, test 103/103, e2e 38 passed (chromium, firefox, phone projects).

### 2026-09-30T16:00:55Z
phase: backlog -> done
