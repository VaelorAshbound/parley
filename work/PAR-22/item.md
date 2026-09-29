---
id: PAR-22
title: Start page polish from the Checkpoint 6 review
phase: done
priority: low
origin: PAR-1
created: 2026-09-28T17:21:40Z
updated: 2026-09-29T21:46:59Z
---

- Keyboard focus is lost when a start fails (the focused button turns disabled): use aria-disabled, or move focus to the problem note.
- SiteFooter sits inside <main>: move it out, so it is a contentinfo landmark.
- Reduced motion: the unlayered animation shorthand beats Tailwind's animation-delay utilities, so the marker shows before the Purpose ink; set delays through a custom property.
- T37 notes say the reveal runs off the main thread; the background-size sweep and --ink color are main-thread paints. Fix the note.
