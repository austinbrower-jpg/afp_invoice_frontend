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
precisely how a Notion-reading portal earns a stutter on a table of eleven rows. The feel
here comes from timing, density, type, and one restrained pulse on the record LED. If a
proposed effect needs a render loop, it does not go in.

Respect `prefers-reduced-motion`. The LED pulse and every transition drop out under it.

## Theme switching

**Not now. Seam only.**

Every color is a CSS custom property on one wrapper, so a second theme is a token block
and a class swap. That costs nothing to preserve and should be preserved.

A settings UI to switch themes costs real work and serves one user who will choose once.
It does not get built until there is a reason beyond wanting it. Keep the tokens scoped,
keep hardcoded hex values out of components, and the door stays open.
