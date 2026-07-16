# 10 — Visual direction

**Chosen: Station.** Reference build: `prototype/two-directions.html`, pane A.

Two directions were built and compared. Station is the instrument-panel direction. Depth
(pane B, type-as-hero, lit field) was not chosen. The greenbar ledger in
`prototype/hours-worked-redesign.html` was an earlier exploration and is **superseded for
the console**, though its logic and its data handling are still correct and worth lifting.

Build Station. Do not build greenbar. Do not build Depth.

## The rule that governs everything here

**Two surfaces, two audiences, opposite freedoms.**

| Surface | Who sees it | How far it can go |
|---|---|---|
| **Console** | Austin, daily | As far as he wants. Nobody else looks at it. |
| **Paper** (the invoice PDF) | AFP accounts payable | Nowhere. Boring is the point. |

Credibility on an invoice *is* boringness. AP wants a document that looks like every other
document they process. So the invoice stays black on white with a logo, a rule, and a
period band, exactly as specified in `06-ui-spec.md`.

The console is under no such obligation. These are not one design system and should not be
unified. When a token or a component seems to want to be shared between them, that is the
signal to stop, not to abstract.

## Station tokens

Scope all of these to a single wrapper. This is the theme seam. See below.

```css
--bg:     #0A0C10;   /* field */
--panel:  #11151B;   /* module surface */
--line:   #1F2731;   /* hairline */
--line-2: #2A3440;   /* emphasis rule */
--tx:     #CBD4DE;   /* primary text */
--dim:    #66727F;   /* secondary */
--dim-2:  #454F5B;   /* labels, ticks, non-billable */
--amber:  #F0A93B;   /* signal: live hours, worked time */
--hot:    #FF6250;   /* money owed, recording, now */
--ok:     #4FB286;   /* invoiced, settled */
```

Type: **Saira** for UI and labels, **JetBrains Mono** for all data and numerals. Two
families, no more. Tabular numerals everywhere a figure can change.

Amber, not acid green. Green-on-black is where "futuristic" collapses by default, and it
reads as a hacker costume. Amber reads as an instrument, which is what this is. No
scanlines, no glowing terminal text, no CRT curvature. The credibility is already in the
work; dressing it up spends it.

`--hot` is reserved for money you have not collected, plus the recording state and the
"now" hairline. It is the only warm alarm color on the page, so the eye lands on it first.
Do not spend it on anything else.

## Signature: the day trace

The single most valuable element and the reason to build Station rather than Depth.

Each day renders as a 24-hour band, midnight to midnight, with worked segments lit in
amber, non-billable in grey, and a `--hot` hairline for the current time on today's row.

It is not decoration. It surfaces information the current app has and shows nowhere: that
July 14 was three fragmented blocks spread across eight hours, that real work days start
at 07:00, where the gaps fall, and whether two sessions overlap. Overlap in particular is
a billing error you cannot currently see and can see instantly here.

Segments position from `Start Time` and `End Time` as a percentage of 1440 minutes. Those
fields are inconsistent text (`7:00 AM` and `07:00` both appear, see gap 5), so normalize
on read before mapping.

## Performance

Both directions are pure CSS on purpose. No WebGL, no three.js, no animation library.

The app is already slow and the standard route to "futuristic" is a 3D canvas, which is
precisely how a Notion-reading portal earns a stutter on a table of eleven rows. If a
proposed effect needs a persistent per-frame render loop, a canvas, or a physics or
particle library, it does not go in. That is a hardware and correctness constraint, not a
taste constraint, and it is not relaxed below.

Bounded, one-shot animation is different and is welcome. A count-up on a total that runs
for 250ms after a value changes and then stops is not a render loop, it is a transition
with a duration, and the same is true of a print wipe, a selection state, or an LED fill.
Updated 2026-07-16: this project is a one-user tool with one owner, and the owner wants
more character here, not less. See "Motion and character" below for the specific list.
The one restrained pulse this section used to limit things to is gone as a limit; the
render-loop and canvas prohibition above is the only hard line left.

Respect `prefers-reduced-motion` regardless of the above. Every animation in this document
drops out under it, no exceptions. That is an accessibility floor, not a style choice, and
loosening the style choice does not touch it.

## Motion and character

Added 2026-07-16, after Station was already built and working. These six items are
approved, specific, and meant to be built as described, not treated as loose inspiration.
Each is pure CSS or a short bounded transition, none needs a render loop, and every one of
them drops out under `prefers-reduced-motion` per the Performance section above.

### The hours gauge

The day-trace band stays as specified. Add a second use of the same signal: a circular
dial on the Dashboard showing hours-this-month as a needle sweeping toward a monthly
target. Built with `conic-gradient` for the fill arc and `transform: rotate()` on a needle
element for the pointer, both driven by a CSS custom property set from the actual value,
not JavaScript animating per frame. Transition the custom property with `transition` on
`--fill-percent` so the needle eases to its new position over a value change instead of
jumping.

A month with no hours logged yet still renders the dial at rest, empty arc, needle at the
zero position, rather than an empty state or a hidden component. An instrument at rest
still looks like an instrument. This solves the "blank dashboard on the first day of the
month" problem without a separate empty-state design.

### Totals count instead of snap

When the date range changes and the invoice total recalculates, animate the number over
200 to 300ms instead of replacing the text node instantly. This is the moment
`06-ui-spec.md` already names as the point of the tool, watching the number update live,
and right now nothing marks that moment as having happened.

Implementation note for whoever builds this: a smooth numeric count-up needs to step the
displayed value across a handful of frames, which does mean a short `requestAnimationFrame`
loop, but a bounded one that runs for a fixed 200 to 300ms and stops, not a persistent
loop that runs for the life of the page. That is not what the render-loop prohibition in
Performance is about. Use tabular numerals (already the type choice for all data) so
digits do not jitter horizontally as they change.

### Status as signal lights

`Billing Status` renders as a small circular indicator next to each row instead of a text
pill, reusing the existing Station tokens rather than adding new colors:

| Status | Render | Token |
|---|---|---|
| Draft | hollow ring | `--dim-2` |
| Reviewed | filled dot | `--dim-2` |
| Ready to Invoice | filled dot | `--amber` |
| Invoiced | hollow ring | `--ok` |
| Paid | filled dot | `--ok` |
| Superseded | filled dot, small diagonal strike through it | `--dim-2` |

Ring versus fill carries the meaning, not just color, so Draft and Invoiced both stay
legible without relying on the amber and green reading correctly against every possible
display or color-vision difference. The diagonal strike on Superseded distinguishes "dead,
never happened" from "not started yet," which a same-color dot alone cannot.

### Save PDF is a transition, not just a print dialog

`docs/10` already frames the console and the paper as two deliberately opposite worlds.
Right now that idea is only visible in the CSS, never felt. On the "Save PDF" action, run a
brief wipe or flip from the dark console to the white paper, under 300ms, before the
browser's print dialog opens. A `clip-path` wipe or a `transform: scaleY` reveal both work
and need no new dependency. Skipped entirely under reduced motion, the print dialog just
opens immediately as it does today.

### Selection feels like a physical toggle

Session checkboxes in the invoice builder and any other row-selection control get a
mixing-console treatment: an amber left-edge bar that lights up on selection, transitioning
`background-color` or `box-shadow` over roughly 120ms, in addition to or instead of a
conventional checkbox. The goal is that selecting sessions feels like flipping channel
strips, not filling out a form. Keep the underlying control a real, keyboard-accessible
checkbox or button regardless of how it is painted, the Quality floor's keyboard-focus
requirement still applies.

### Eyebrow labels everywhere

The mono, uppercase, wide-letter-spacing label treatment already exists for a few spots.
Apply it to every section header consistently, Dashboard, Hours Worked, invoice builder
panels, all of it, so it reads as instrument labeling throughout the app rather than
decoration in one or two places.

## Theme switching

**Not now. Seam only.**

Every color is a CSS custom property on one wrapper, so a second theme is a token block
and a class swap. That costs nothing to preserve and should be preserved.

A settings UI to switch themes costs real work and serves one user who will choose once.
It does not get built until there is a reason beyond wanting it. Keep the tokens scoped,
keep hardcoded hex values out of components, and the door stays open.
