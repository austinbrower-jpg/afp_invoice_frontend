# Cockpit customization design

Status: approved 2026-07-16, ready for implementation planning. Builds on the AFP Station
Cockpit (docs/superpowers/specs/2026-07-16-afp-station-cockpit-design.md).

## Goal

Let the owner customize the console: pick a color theme, pick a layout, and pick which metric
the hours dial shows. Choices persist across visits. The whole thing is built on one settings
object so a future widget board can grow from it without rework.

This stays a frontend change. Notion is still read-only. The only new persistence is UI
preferences in localStorage (see the rule change below).

## Decisions locked during brainstorming

- Themes: 6. Station (default), Ion, Ember, Daylight, Overdrive, Mono. Palettes below.
- Layouts: 3. Balanced (default), Invoice focus, Instruments focus.
- Dial metric: 4. Today, This week, This month, Unbilled.
- Persistence: localStorage, UI preferences only. The "no browser storage" rule is amended
  for preferences (not billing data). See below.
- Overdrive glows both the money and the worked figures (owner chose max drama). Pure CSS
  shadow, no render loop.
- Daylight recolors the console only; the paper stays white (it is a print artifact).
- Architecture is a single settings object, extensible to widgets later.

## Rule change: browser storage

`docs/06-ui-spec.md` says "No browser storage of any kind." That rule was to keep Notion and
billing data off the client. This spec amends it: UI preferences (theme, layout, dial metric)
may be stored in localStorage under a single key. Notion data and anything billing-related
still never touch storage. The plan updates the quality-floor note in `docs/06-ui-spec.md` to
record this scoped exception.

## Architecture

### Settings state

```
export type ThemeName = "station" | "ion" | "ember" | "daylight" | "overdrive" | "mono";
export type LayoutName = "balanced" | "invoice" | "instruments";
export type DialMetric = "today" | "week" | "month" | "unbilled";
export type Settings = { theme: ThemeName; layout: LayoutName; dialMetric: DialMetric };

const DEFAULTS: Settings = { theme: "station", layout: "balanced", dialMetric: "month" };
```

A `useSettings` hook owns this. On mount it reads localStorage key `afp.cockpit.settings.v1`,
validates it (any unknown or corrupt value falls back to the matching default), and returns
`{ settings, setTheme, setLayout, setDialMetric }`. Every setter writes the whole object back
to localStorage and updates the `data-theme` and `data-layout` attributes on the document root.

### No flash of the default theme

A tiny inline script in `app/layout.tsx` `<head>` runs before paint: it reads the same
localStorage key and sets `document.documentElement.dataset.theme` and `.dataset.layout`. Since
the theme and layout CSS key off those attributes, the correct look is present on the first
paint, with no flash and no hydration mismatch (React does not manage those attributes). The
inline script is small, dependency-free, and fails safe to the defaults.

### Theme CSS

Themes are token blocks keyed on the root attribute, applied to the console wrapper:

```
:root[data-theme="ion"] .station { --bg: ...; --panel: ...; --amber: ...; --hot: ...; --ok: ...; }
```

The existing semantic token names are kept (`--amber` = worked, `--hot` = money owed, `--ok` =
settled) and only their values change per theme. Note the naming wart: in Ion, `--amber` holds
a cyan value. Renaming every token to `--worked`/`--owed`/`--settled` across all components is
out of scope; a code comment documents this so `--amber: #38BDF8` does not read as a bug. Each
theme keeps the three signal colors visually distinct.

Overdrive adds glow rules gated to `:root[data-theme="overdrive"]` (text-shadow on the money and
worked figures, box-shadow on the signal dots and bars). Pure CSS, dropped under reduced motion
only if animated (these are static shadows, so they stay).

Palettes (core tokens; `--line-2` and `--dim-2` are one step lighter than `--line`/`--dim`):

| Theme | bg | panel | line | tx | dim | worked (--amber) | owed (--hot) | settled (--ok) |
|---|---|---|---|---|---|---|---|---|
| Station | #0A0C10 | #11151B | #1F2731 | #CBD4DE | #66727F | #F0A93B | #FF6250 | #4FB286 |
| Ion | #080B12 | #0F1620 | #1C2A38 | #C6D6E6 | #5E7180 | #38BDF8 | #FB7185 | #34D399 |
| Ember | #0E0A08 | #1A1310 | #33241C | #E6D5C6 | #8A7160 | #FBBF24 | #E11D48 | #2DD4BF |
| Daylight | #F4F5F7 | #FFFFFF | #D8DCE2 | #1A1F26 | #6B7480 | #B45309 | #DC2626 | #059669 |
| Overdrive | #070510 | #130A26 | #2E1A50 | #ECE4FF | #8778B0 | #FF2E97 | #FF3B57 | #2EF2FF |
| Mono | #0C0D0E | #141516 | #26282A | #D4D6D8 | #6A6E72 | #B8BCC0 | #C79A5A | #7E8286 |

Daylight is a light console. The paper stays white and is kept distinct by its existing drop
shadow. The two design systems stay separate: no theme touches the paper tokens.

### Layout CSS

Layouts key off `:root[data-layout="..."] ` on the cockpit containers.

- Balanced (default): the current arrangement. No new rules.
- Invoice focus: collapse the day-trace module and the earnings module (display none), slim the
  instrument cluster to a one-line KPI strip, and widen the paper by narrowing the console
  column. Pure CSS.
- Instruments focus: enlarge the day trace and the dial, keep earnings prominent, and replace
  the full paper on screen with a compact summary card (see below). Pure CSS toggles which of
  the two invoice views shows; the full paper stays in the DOM so printing is unaffected.

### Compact invoice summary card (new component)

The one piece that is more than CSS. `InvoiceSummary` renders a small card: the amount owed for
the current selection, the session count, and a "Build invoice" button. It shows only under
`data-layout="instruments"` (CSS), sits beside the hidden full paper, and its button switches
the layout to `invoice` (calls `setLayout("invoice")`). In print, the summary card is hidden and
the full paper prints as always.

### Settings panel UI (new component)

`SettingsPanel`: a gear button in the topbar opens a slide-out panel (or popover). It contains:

- Theme: the six swatches, click to apply (calls `setTheme`).
- Layout: the three options, click to apply (calls `setLayout`).
- Dial metric: a select with Today / This week / This month / Unbilled (calls `setDialMetric`).

Changes apply live. The panel is keyboard accessible (focus visible, escape to close), per the
existing quality floor.

### Dial metric wiring

The dial currently shows hours this month vs a 60h target. It becomes driven by
`settings.dialMetric`:

| Metric | Center value | Target for the arc | Label |
|---|---|---|---|
| today | today hours | 8 | Hours today |
| week | week hours | 40 | Hours this week |
| month | month hours | 60 | Hours this month |
| unbilled | unbilled dollars | unbilled hours / 60 fill | Unbilled |

All four readouts already exist in `lib/hours.ts` (`dayReadout`, `weekReadout`, `monthReadout`,
`unbilled`). The dial component takes the resolved value, target, unit, and label, so it stays
presentational.

## Widget seam

The `Settings` object is the seam. A future widget board extends it to include a `panels` array
(what is shown and where) and reads and writes the same localStorage key with a bumped version.
Nothing in this design blocks that; the layout system is the intermediate step between fixed
layouts and free-form widgets.

## Edge cases

- Corrupt or partial stored settings fall back to defaults per field, never throw.
- First visit (nothing stored) renders the defaults (Station, Balanced, month).
- Reduced motion: the theme swap and any transitions respect the existing global rule.
- Print is unaffected by theme or layout: the paper always prints as the verified artifact.

## Verification

- Unit tests for `useSettings`: defaults on empty storage, round-trip save and load, corrupt
  value falls back to default, unknown theme falls back to default.
- Theme and layout checked visually (companion or local run), including Daylight console vs the
  white paper, and Overdrive glow.
- Persistence confirmed by changing settings and reloading.
- Print still clean under every theme and layout.

## Out of scope

- Full drag-and-drop widget board (a possible later phase; this design sets it up).
- Per-widget add and remove.
- Syncing settings across devices (localStorage is per device, which is fine for one user).
