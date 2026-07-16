# AFP Station Cockpit design

Status: approved 2026-07-16, ready for implementation planning.

## Goal

Merge the two existing screens (the Station dashboard at `/dashboard` and the invoice
builder at `/`) into one unified instrument-panel cockpit. Add an earnings-by-week
instrument. Push the Station character further within the existing performance line. Host
the result on Vercel behind the login that already exists, so it is usable from a phone.

This is a frontend restructure. It does not change the Notion backend and it does not add a
write path. Notion stays the read-only source of truth, edited by hand on the Notion side.

## Decisions locked during brainstorming

1. Approach: restructure in place. Keep the working data layer, auth, and invoice
   calculation plus print CSS. Build the cockpit around them. Do not rebuild what already
   works.
2. Layout: instrument cluster on top (the four readouts plus the full-width day trace),
   split below (session and earnings on the left, live invoice paper on the right).
3. Earnings by week: horizontal week bars. Bar length is dollars. Color splits collected
   (green) from owed (hot red). The current week is outlined in amber.
4. Run live means hosted at a real URL on Vercel behind the existing signed-cookie auth,
   reachable from a phone.

## Constraints carried in from the repo

These are existing rules from `CLAUDE.md` and `docs/`, restated so the plan honors them.

- `NOTION_TOKEN` is server-side only. Notion data reaches the client only through the API
  route.
- Read-only. No write-back to Notion. If a task seems to need a write, stop and ask.
- Port `prototype/invoice-builder.html` logic and its `@media print` block. Do not rebuild
  them.
- The console (Station) and the paper (the invoice) are two separate design systems. Do
  not unify their tokens.
- No Tailwind. Global stylesheet or CSS module.
- All hour rounding happens client-side. The API returns raw floats.
- Notion page IDs are join keys. Strip dashes before comparing.
- Brand assets import only from `public/brand/`, PNGs.
- The `#6366f1` accent is the AFP client color, not a BBB color.
- No em dashes in code, docs, or commit messages. Interface copy is plain and active.
- Performance line: no persistent render loop, no canvas, no 3D, no particle or physics
  library. Bounded one-shot CSS transitions are welcome. Every animation drops out under
  `prefers-reduced-motion`.

## Architecture

| Layer | Plan |
|---|---|
| `lib/notion.ts`, `app/api/notion/afp/route.ts`, `app/useAfpData.ts` | Untouched. The cached, rate-limit-safe read path stays as is. |
| `lib/invoice.ts` and the print CSS | Ported into the cockpit. Not rebuilt. |
| `lib/hours.ts` | Reused. One new function added: `weeklyEarnings`. |
| `app/dashboard/*` route | Retired. `/dashboard` redirects to `/`. |
| `/` route | Becomes the cockpit. |
| `app/page.tsx` (687 lines) | Decomposed into focused components. |

Both current screens already derive from the single `Payload` the API returns, so unifying
them removes a seam rather than creating a second source of truth. The dashboard's unbilled
figure and the builder's default session selection already share logic in `lib/hours.ts`,
which is why they cannot disagree, and that property must be preserved through the merge.

## Components

### Reused without change

- `StatGauge` (in the dashboard today): the four readouts, Today, This week, This month,
  Unbilled. Unbilled stays in hot red.
- `DayTrace`: the 24-hour band with amber worked segments, grey non-billable, hot now-line,
  and overlap detection.
- `HoursGauge`: the monthly hours dial.
- `StatusLed`: the billing-status signal light.
- `SyncStatus`: the live and last-synced pill.
- `useAfpData`, `useCountUp`: the polling hook and the bounded count-up.

### New: `weeklyEarnings` in `lib/hours.ts`

A pure function, no new Notion access. Groups sessions by `startOfWeekISO`, then per week
sums the billable non-superseded hours and dollars, and splits the dollars into collected
versus owed using the same status sets already defined in the file (`isLive` drops
superseded and non-billable, `BILLED_STATUSES` is `Invoiced` and `Paid`).

Proposed shape:

```
export type WeekEarning = {
  weekStart: string;   // ISO Monday
  hours: number;       // billable, non-superseded
  amount: number;      // collected + owed
  collected: number;   // dollars from Invoiced or Paid sessions
  owed: number;        // dollars from billable sessions not yet invoiced
  isCurrent: boolean;  // weekStart === startOfWeekISO(today)
};

export function weeklyEarnings(payload: Payload, today: string, weeks = 6): WeekEarning[]
```

Returns the most recent `weeks` weeks, newest first, current week included even at zero so
the instrument renders at rest rather than disappearing.

Note that `owed` here is deliberately simpler than the existing `unbilled()` function.
`unbilled()` applies date-window bounds (after the last invoice period, not in the future)
because it drives the builder's default selection. `weeklyEarnings` instead reports what was
earned in each calendar week, split only by whether the dollars are already on an invoice.
The two answer different questions and are not expected to produce the same total. The plan
must not collapse one into the other.

### New: `EarningsByWeek` component

Pure CSS, no render loop. One horizontal bar per `WeekEarning`. Bar length maps dollars
against the max week in the set. The bar fills collected in `--ok` green and owed in
`--hot`, so a week that is fully paid reads all green and a week still out reads red. The
current week is outlined in `--amber`. Bars ease to width on load with a bounded transition
that is removed under reduced motion. Row labels use tabular mono numerals.

### Carved out of `app/page.tsx`

The invoice builder is one 687-line file today. Split it so each unit has one purpose:

- `SessionManifest`: the selectable session rows, grouped by day with per-day subtotals,
  painted as channel strips (amber left-edge bar lights on selection). The underlying
  control stays a real keyboard-accessible checkbox.
- `InvoiceControls`: invoice number, date, terms, due, work-detail mode, hour rounding,
  show-non-billable, print session IDs.
- `InvoicePaper`: the live 8.5 by 11 invoice and Save PDF. Owns the print CSS.
- `DataFlags`: the specific advisory flags for the current selection.
- The cockpit page composes the instrument cluster, the left pane
  (`SessionManifest`, `EarningsByWeek`, sticky running total, `InvoiceControls`), and the
  right pane (`InvoicePaper`).

## Data flow and rounding

The server returns raw floats and normalized times. The client computes every readout,
the day-trace geometry, the weekly earnings, and the invoice math from that one `Payload`.
Rounding stays client-side so the user can change the rule and watch the invoice update.
Exact to two decimals stays the default, matching the AFP-2026-001 precedent.

## The paper and PDF

The paper keeps its own design system: black on white, BBB letterhead from `public/brand/`,
no Station tokens. The print behavior is ported verbatim: `@page size letter` with 0.5in
margin, console and ledger set to `display: none`, the paper drops its shadow and physical
width, `break-inside: avoid` on each work entry, `break-after: avoid` on the work-performed
header. Verified with an actual Cmd+P to PDF, because print preview lies about page breaks.

## Character and motion

Within the performance line above. In scope: the count-up on totals, the earnings bars
easing in, the channel-strip selection glow, and a console-to-paper wipe under 300ms before
the print dialog on Save PDF. Eyebrow labels stay consistent across every section. No effect
introduces a persistent render loop, a canvas, or a dependency. Every animation drops out
under `prefers-reduced-motion`, which is an accessibility floor, not a style choice.

## Responsive and phone

The quality floor already requires a single column under 1100px. Because the tool is now
hosted and used on a phone, define that collapse deliberately: the instrument cluster stacks
(readouts, then day trace), then earnings, then the manifest. The paper collapses to a
Preview and Save PDF affordance rather than a full side-by-side render, because building a
full invoice is a desktop act while checking hours and what is owed is the phone act.
Keyboard focus stays visible. No browser storage of any kind.

## Deploy

Vercel, behind the existing signed-cookie auth in `middleware.ts`, per `docs/08-deploy.md`.
The user sets `NOTION_TOKEN` and `APP_SECRET` as Vercel environment variables. Those secrets
are never handled in chat or committed. The Notion integration must be shared with the
Invoice Details page or every query returns empty with no error. The production URL must
return 401 without credentials before this is considered shipped.

## Edge cases and error handling

- Data-gap flags carry over: a selected session with no linked Work Done row, a Work Done
  with Include in Invoice unchecked while its hours are selected, a not-yet-approved
  description, an already-invoiced session, a non-billable session. Flags are advisory, the
  server enforces.
- Instruments render at rest before mount and on an empty month, no separate blank state.
- A fatal Notion read error shows the existing error panel, not a half-broken cockpit.
- Changing the date range clears and re-runs the auto-select, so a stale selection from a
  previous range cannot bill the wrong week.

## Verification

1. `npm run typecheck` clean.
2. Log the raw Notion join and eyeball it, per Phase 1 discipline.
3. Confirm cockpit figures equal what the builder would bill (the shared-logic property).
4. Actual Cmd+P to PDF: clean letter-size document, console stripped, no orphaned headers,
   no work entry split across a page break.
5. Responsive check at phone width. Reduced-motion check.
6. Confirm the production URL returns 401 without credentials.

## Things we can revisit later

- Snapshot immutability (Phase 6 in `docs/01-plan.md`) is still out of scope until a
  description is edited after an invoice is sent.
- Theme switching stays a seam only. Tokens stay scoped to one wrapper, no settings UI.
- The monthly hours target (currently 60) is a constant, not Notion data. Adjust in code if
  the cadence changes.
