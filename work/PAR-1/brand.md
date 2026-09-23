# Parley brand: Paper & Ink

> Status: approved 2026-09-23 · Work item: PAR-1 · Task: T4
> Design canvas: https://claude.ai/artifact/98zhHMskM8kyTANrg8qHqj (source in [design/](design/))

## The idea

- **Black type is the agreement.** Common Paper's words are set like a printed contract.
- **Blue ink is what you filled in.** Every value you or Parley set is blue, like a pen on a form.
- **A highlighter shows what changed.** When the AI changes a field, a yellow highlighter sweeps over it, and a blue change bar marks the row in the margin, like a lawyer's redline.

Why: the live document is the wow moment (spec §1). This makes each change easy to see and trust without extra UI. It also keeps us far from the Claude look, even though the layout follows the Claude app (no clay or orange).

## Logo

A pilcrow (¶), the sign for a new paragraph. Its bowl is a speech bubble: a conversation becomes a clause.

```svg
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M12.6 3V13H8.6L5 15.8L5.6 12.05A5 5 0 0 1 8.5 3Z" fill="#2743C4"/>
  <path d="M13.4 3H20V21H17.9V5.1H15.5V21H13.4Z" fill="#1B1A17"/>
</svg>
```

- **Light:** bowl `#2743C4`, stems `#1B1A17`. **Dark:** bowl `#9DAEFF`, stems `#EDEAE3`.
- **App icon / favicon:** ink square (`#1B1A17`, radius ≈ 22% of the side), bowl `#9DAEFF`, stems `#FAF8F3`, mark at ≈ 65% of the side.
- **Wordmark:** "Parley" in Newsreader 500, tracking −0.02em, next to the mark.
- Clear space = the bowl's height on every side. Never rotate, stretch, outline or recolor.

## Color

All values checked with a script (WCAG 2.x formula). Every text pair passes AA (4.5:1).

| Token | Light | Dark | Use | Contrast (light / dark) |
|---|---|---|---|---|
| paper | `#F6F4EE` | `#141412` | App ground | — |
| paper-deep | `#EDEAE2` | `#0E0E0C` | Behind the document | — |
| sidebar | `#F0EDE6` | `#181715` | Sidebar, rail | — |
| surface | `#FFFFFF` | `#1F1E1B` | Cards, composer, questionnaire | — |
| sheet | `#FFFDF9` | `#1C1B18` | The document page | — |
| bubble | `#ECE8DF` | `#2A2925` | Your chat messages | — |
| hover / active | `#E9E5DB` / `#E6E2D8` | `#2B2A26` / `#302E2A` | Row hover, current item | — |
| rule | `#E3DED3` | `#2E2C28` | Hairlines | — |
| rule-sheet | `#ECE7DC` | `#292724` | Rows inside the document | — |
| rule-strong | `#D5CFC2` | `#3D3B35` | Input borders | — |
| ink | `#1B1A17` | `#EDEAE3` | Text, primary button | 15.8 / 15.4 on paper |
| ink-2 | `#57544C` | `#B8B3A9` | Secondary text | 6.9 / 8.8 on paper |
| ink-3 | `#6A665D` | `#9C978C` | Captions, checkbox borders | 5.2 / 6.3 on paper; 4.8 / 6.6 on paper-deep |
| ink-4 | `#A29D92` | `#6A665E` | Decoration only (arrows). Never text. | — |
| on-ink | `#FAF8F3` | `#151412` | Text on the primary button | 16.4 / 15.3 |
| blue-ink | `#2743C4` | `#9DAEFF` | Filled values, links, focus, progress | 7.7 / 8.2 on sheet |
| blue-tint | `#EEF1FC` | `#1D2340` | Selected option, focus halo | — |
| blue-border | `#9AA9E6` | `#4A5A9E` | "Asking" frame, focused composer | — |
| on-blue | `#FDFDFF` | `#10142A` | Check marks, selected letter keys | 7.7 / 8.6 |
| highlighter | `#FFE58A` | `#4B3F14` | Field just changed | blue on it: 6.3 / 4.9 |
| highlighter-soft | `#FFF1BC` | `#342C10` | Settled highlight | blue on it: 6.9 / 6.6 |
| empty | `#F2EFE8` | `#252420` | Empty field chip | ink-3 on it: 5.0 / 5.3 |
| empty-border | `#CFC8B9` | `#4A4740` | Empty field chip border (dashed) | — |

**Dark mode:** the document page goes dark too (decided 2026-09-23). One theme everywhere, calm at night. The PDF and DOCX stay light, as printed paper.

**Shadows:** light mode uses warm ink shadows `rgba(27,26,23,…)`; dark mode uses black at about 3× the alpha. The document sheet has a 1 px ring plus a long soft shadow, so it reads as paper.

## Type

| Family | Role | Why |
|---|---|---|
| **Newsreader** (variable, `opsz` 6–72, `wght` 300–700, italic) | Headlines and the document | Optical sizes: crisp at 11 px in a contract, elegant at 80 px. Italic in blue marks what matters. |
| **Instrument Sans** (variable, `wght` 400–700) | Interface | Clear at 12 px, a little warm, not a default AI font. |

| Style | Spec |
|---|---|
| Display | Newsreader 76 / 0.98 · −0.032em · 400 |
| Title | Newsreader 46 / 1.04 · −0.024em · 400 |
| Question (questionnaire) | Newsreader 21 / 1.25 · −0.01em · 500 |
| Contract (preview) | Newsreader 14.5 / 1.55 · 0 · 400 |
| Body | Instrument Sans 15 / 1.6 · 0 · 400 |
| Small | Instrument Sans 13.5 / 1.45 · 0 · 400 |
| Label | Instrument Sans 11.5 / 1.3 · +0.08em · 600 · uppercase |

Big text gets negative tracking; small labels get positive tracking. Turn on `font-optical-sizing: auto`.

**Loading:** self-host with `@fontsource-variable/newsreader` and `@fontsource-variable/instrument-sans` (both 5.3.0 on 2026-09-23), not Google Fonts. Why: the landing page needs LCP under 2.0 s and CLS under 0.05 (spec §8). Self-hosting avoids a third-party connection. Preload the two Latin woff2 files. Add metric-matched fallbacks (`size-adjust`, `ascent-override`) so the swap does not shift layout. In T4, pick the Newsreader entry point that includes the `opsz` axis.

## A field's life (the document preview)

| State | Look | Meaning |
|---|---|---|
| Empty | Sans chip on `empty` with a dashed `empty-border` border, text in ink-3 (for example "State") | Not filled yet. Never a blank line. PDF/DOCX print it as `[State]`. |
| Asking | Dashed `blue-border` frame around the row, `blue-tint` fill, small "Asking in chat" label on the frame | The chat is asking about this field right now. |
| Just changed | Highlighter sweep, value inks in, blue change bar in the left margin | The AI changed it in this turn. Settles to highlighter-soft until the next message. |
| Filled | Blue ink | A value you or Parley set. |
| Editing | Inline input, 1.5 px blue border, 3 px `blue-tint` halo, "Enter to save · Esc to cancel" | You are editing the value yourself. |

Choice fields (checkbox lines on the cover page): the chosen line gets a filled blue box with a check; the other line fades to 42% opacity.

## Motion

| Token | Value | Used for |
|---|---|---|
| ease-out | `cubic-bezier(0.23, 1, 0.32, 1)` | Enters, presses, the highlighter sweep |
| ease-in-out | `cubic-bezier(0.77, 0, 0.175, 1)` | Movement on screen, the hero marker |
| drawer | `cubic-bezier(0.32, 0.72, 0, 1)` | Phone drawer and sheets |
| spring | Motion `bounce: 0, duration: 0.4` | Document panel open/close, resize, clause height changes |
| press | 140 ms, `scale(0.97)` | Every button and option |
| step | 240 ms, 10 px slide + fade | Questionnaire steps; progress bar width 360 ms |
| enter | 340 ms, 6 px rise + fade | New chat messages and markers |
| ink-in | 640 ms sweep + 520 ms blur-in (3 px → 0), settle after 1.6 s over 1.6 s | A field the AI changed |
| change bar | 480 ms `scaleY` 0 → 1 from the top | Row changed this turn |
| check | 260 ms, `scale(0.8)` → 1 + fade | Checkbox and option check marks |
| shimmer | 1.5 s linear loop | "Thinking…", "Updating the document…", "Saving…" |

Rules:

- Keyboard actions never animate (⌘K opens at once).
- Nothing grows from zero: entrances start at 0.8 scale or 6 px away.
- Only `transform`, `opacity` and `filter` move, except the highlighter's `background-size` on short inline text.
- The landing page plays one reveal on load: the sheets fan out, your message pops in, the Purpose field inks in, then its change marker appears. No loops.
- **Reduced motion:** no sweeps, slides or blur. Highlights fade in place (color only). The shimmer holds still.
- **Reduced transparency:** the phone's frosted action bar becomes solid paper.

## Build notes for T4 (after T1)

- Map these tokens to the shadcn theme variables in `apps/web/src/styles/tokens.css` (`--background` = paper, `--card` = surface, `--primary` = ink, `--ring` = blue-ink, and so on), plus Parley tokens for sheet, highlighter and blue-ink.
- Tune shadcn's built-in `shimmer` utility to the ink-3 → ink → ink-3 gradient above.
- The highlighter uses a registered custom property (`@property --pl-hl`) so its color can settle smoothly; see `design/build.py` for the exact CSS used on the canvas.
- `apps/web/public/logo.svg` = the SVG above; the favicon uses the app icon colors.
