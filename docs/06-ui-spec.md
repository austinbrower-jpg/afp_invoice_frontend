# 06 — UI spec

The prototype is the spec. `prototype/invoice-builder.html` renders correctly today
against real data. This document explains why it does what it does, so the port does not
quietly drop something load-bearing.

## Layout

Two panes. Left is the console, right is the paper.

```
┌──────────────────────────────────────────────────────────────┐
│ Invoice Builder   [from] [to]  [presets]        [Save PDF]   │
├────────────────────┬─────────────────────────────────────────┤
│ SESSIONS IN RANGE  │                                         │
│  2026-07-15   7.63 │        ┌───────────────────────┐        │
│  [x] AFP-...-0700  │        │                       │        │
│      7:00 – 2:38   │        │   live invoice at     │        │
│  2026-07-14   6.54 │        │   true 8.5 x 11       │        │
│  [x] AFP-...-1602  │        │                       │        │
│  [x] AFP-...-1345  │        │                       │        │
│ ┌────────────────┐ │        └───────────────────────┘        │
│ │ 4 sessions     │ │                                         │
│ │ 14.17 h        │ │                                         │
│ │ $425.10        │ │                                         │
│ └────────────────┘ │                                         │
│ INVOICE  [fields]  │                                         │
│ DATA FLAGS         │                                         │
└────────────────────┴─────────────────────────────────────────┘
```

The paper is not a preview. It is the printed artifact, rendered at physical dimensions,
and `@media print` removes everything around it. What you see is what comes out.

## Behavior

**Opens ready.** Default range is the day after `lastInvoice.periodEnd` through today, with
every eligible session pre-selected. The common case is "bill me for everything since last
time" and it should require zero clicks before Cmd+P.

**Eligible** means `Billable` is true and status is neither `Invoiced` nor `Superseded`.
A toggle reveals the excluded rows, greyed, so you can see what was skipped and why. Hiding
them entirely would make a missing session look like a data loss bug.

**Changing the range re-selects.** Any range change clears and re-runs auto-select. Keeping
stale selections from a previous range is how you bill the wrong week.

**Running total is sticky.** Hours and amount stay visible while scrolling the ledger.
The number you are about to charge someone should never be off screen.

## Controls

| Control | Notes |
|---|---|
| Date range + presets | Unbilled, This week, This month, All. Unbilled is the default. |
| Session checkboxes | Grouped by day, per-day subtotal in the header |
| Invoice number | Suggested from `lastInvoice`, editable |
| Invoice date, terms, due | Due auto-computes from terms, editable after |
| Work detail | Four modes, see below |
| Hour rounding | Exact (default), quarter hour, tenth |
| Show non-billable | Reveals excluded rows |
| Print session IDs | Whether Session IDs appear on line items |

## Work detail modes

This is the part the whole tool exists for. Hours alone are not an invoice a client will
pay without asking questions.

| Mode | Source | Use |
|---|---|---|
| Invoice descriptions | `Invoice Description` | Default. Client-facing prose, already written. |
| Summaries only | `Summary` | Shorter. Mixed voice, read it before sending. |
| Session notes | Hours `Notes` | Verbatim internal notes. Verbose and unedited. |
| Line items only | none | Hours and amounts, nothing else. |

Entries are deduplicated by Work Done row and stamped with the hours that rolled into
them, because three sessions on July 14 all point at one description.

## Letterhead

The prototype has no logo. Once the entity question in `09-brand.md` is settled, place
`bbb-logo-horizontal-black.png` in the invoice header at roughly 1.6in wide, left of or
replacing the "Invoice" heading. Black on white, no other change to the paper.

If the answer is that you contract personally, the invoice stays unbranded and this
section does not apply.

## Editable blocks

`From` and `Bill to` are `contenteditable` directly on the paper. That data does not exist
in Notion (gap 4) and this is a stopgap, not a design choice. Edits do not persist. When
gap 4 is fixed these become rendered fields.

## Data flags

The panel names specific problems in the current selection, not generic warnings:

- Session selected with no linked Work Done row, so it will print without a description.
- Work Done with `Include in Invoice` unchecked while its hours are selected.
- Work Done not yet `Approved`.
- Session already marked `Invoiced`.
- Session marked non-billable.

Flags are advisory. The server enforces. See `05-api-routes.md`.

## Print

The deliverable. Non-negotiable properties:

- `@page size: letter; margin: 0.5in`
- Console and ledger `display: none`
- Paper drops its shadow and physical width, fills the page
- `break-inside: avoid` on each work entry, so a description never splits across pages
- `break-after: avoid` on the "Work performed" header, so it never orphans

Test with an actual Cmd+P to PDF. Print preview lies about page breaks.

## Hours Worked dashboard

`prototype/hours-worked-redesign.html` was the first visual exploration for the portal's
Hours Worked view. It is superseded on looks by Station, see `docs/10-visual-direction.md`
and `prototype/two-directions.html` pane A. Do not build this file's greenbar theme.

Its data handling is not superseded. It demonstrates the sidebar-plus-content layout the
README's Status section implies (Dashboard, Clients, Invoice Details, Work Stuff,
Settings), and the range-filter and status logic below are still correct and worth
lifting into Station's shell.

Two things to reconcile during the port, found comparing this file's fixture against the
live workspace and against the invoice builder's own `DATA` const:

- Its status column shows `"Non-billable"` for session `AFP-2026-07-08-001`. The real
  `Billing Status` for that row is `Reviewed`, verified live on 2026-07-15, and `Reviewed`
  is what `invoice-builder.html`'s `DATA` const correctly shows for the same session.
  `"Non-billable"` is not a value `Billing Status` ever takes, see the select options in
  `03-notion-schema.md`. It reads as a derived display label, `Billable === false`, laid
  over a `Reviewed` row, not a raw Notion status. Decide on the port: either derive that
  label client-side from `Billable` the same way, and document it as derived, or drop it
  and show the raw status like the invoice builder does. Do not treat `"Non-billable"` as
  a fifth thing `Billing Status` can be.
- Its range presets (`week`, `month`, `unbilled`, `all`) hardcode date literals like
  `"2026-07-13"` against today's date. That is correct for a static fixture and wrong for
  live code. The ported version computes these relative to the current date, not a
  snapshot date.

## Quality floor

Responsive down to a single column under 1100px. Visible keyboard focus. Reduced motion
respected. No browser storage of Notion or billing data. UI preferences (theme, layout, dial metric) may be stored in localStorage under a single key, per docs/superpowers/specs/2026-07-16-cockpit-customization-design.md.
