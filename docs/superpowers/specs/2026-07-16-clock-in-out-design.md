# Clock in / out design

Status: draft. Design presented to Austin on 2026-07-16 and the core decisions are
settled (see below). Final approval was deferred because he stepped away mid-session.
Review this before implementation. The next step after approval is the writing-plans
skill, not code.

## Goal

Add a clock in / clock out control to the AFP cockpit that logs a work session to the
Hours Worked database in Notion. Austin wants to clock out for breaks and have the
session added for him, so he stops hand-entering rows.

This reverses one standing rule on purpose. See the rule change section.

## Decisions already made

These were chosen by Austin during the 2026-07-16 brainstorm and are not open:

1. **One row per clock pair.** Each clock in then clock out writes one Hours Worked row.
   A break is just clocking out (ends the row) and clocking in again later (starts a new
   row). This matches the existing data, which already has several short sessions per day.
2. **Fully automatic on clock out.** Clock out writes the row immediately, no confirm
   step. The row is written with `Billing Status = Draft`, which never bills until Austin
   marks it Reviewed, so Draft is the safety net in place of a confirm dialog.
3. **Insert capability on the existing Notion integration.** Austin picked the simpler of
   the two token options. Enable "Insert content" on the current integration and leave
   "Update content" and delete off. The one token can then read and add rows but still
   cannot rewrite or delete existing billing records. The clock route only ever inserts.

## Open point for Austin to confirm

- **Browser-storage rule amendment.** Persisting the live clock across a reload needs the
  in-progress clock (start time, date, location) stored under one localStorage key. That
  is a one-line amendment to docs/06-ui-spec.md, the same shape as the existing UI
  preferences exception. Completed sessions and billing history still never touch the
  browser. The recommended choice is to make the amendment. The alternative is in-memory
  only, which changes no rule but loses an in-progress clock on reload or tab close.

## Architecture

Four small units, each testable on its own.

### lib/clock.ts (pure helpers)

- `sessionId(dateISO, start, end)` returns `AFP-2026-07-16-0903-1027`, the existing
  Session ID format.
- `hoursBetween(startMs, endMs)` returns a raw float, correct across midnight. Rounding
  stays client-side per the project rule, so this stores the raw float in Total Hours.
- `elapsed(ms)` returns `1:23:45` for the live timer.
- Times are formatted through the existing `toDisplay` so they read as `9:03 AM` like the
  rest of the app. Times come from the browser local clock, which is already Chicago time.

### app/useClock.ts (hook)

Owns `{ startedAt, date, location } | null`.

- Clock in stores that under one localStorage key `afp.clock.v1`.
- A live timer ticks for the display.
- Clock out computes the end time and hours, POSTs to `/api/clock`, and only on a
  confirmed 200 clears local state and calls the existing `refresh()` from useAfpData so
  the new row shows up.
- On mount, if a stored clock exists with a date earlier than today (forgot to clock
  out), it surfaces the open clock with a warning rather than silently writing a
  many-hour session. Austin then clocks out or discards.

### POST /api/clock (app/api/clock/route.ts)

- Already gated by the existing auth middleware, which returns 401 without the signed
  cookie. No new auth code.
- Validates the payload: hours greater than zero and under a sane cap.
- Calls one new server function, `insertSession()` in lib/notion.ts.
- On a Notion permission error (Insert not enabled yet), returns a clear message so the
  cause is obvious.

### insertSession() in lib/notion.ts

A server function that does one `pages.create` into Hours Worked, mirroring how
`fetchPayload` is the single place that talks to Notion. Properties written:

- `Date` (title) = ISO date
- `Session ID` (rich_text)
- `Start Time` (rich_text), `End Time` (rich_text)
- `Total Hours` (number) = raw float
- `Hourly Rate` (number) = 30
- `Billable` (checkbox) = true
- `Billing Status` (select) = Draft
- `Location` (rich_text)
- `Client` (relation) = the AFP client page

Uses env already present: `NOTION_DS_HOURS`, `NOTION_CLIENT_PAGE`.

## Data flow

Clock in stores the start locally and starts the timer. Clock out computes end and hours,
POSTs, Notion inserts a Draft row, and on success the local state clears and the console
refetches. Because the GET route caches for 60 seconds, the write path must bust that
cache (revalidate) so the session appears at once rather than up to a minute later.

## UI

A control in the topbar next to Save PDF.

- Clocked out: a "Clock in" button and a small location selector defaulting to Remote.
- Clocked in: a running elapsed timer, the start time, and a "Clock out" button.
- Saving shows a spinner. A failed write keeps the running clock and shows Retry, so a
  failed save never loses the session.

## Error handling

- Write failure keeps local state and offers Retry.
- Insert capability missing maps to a clear "enable Insert content" message.
- Stale overnight clock is flagged on open, never auto-written.
- Zero or negative duration is rejected.

## Scope, YAGNI

- Location is a small selector with a Remote default. No Project picker.
- No break field. Breaks are separate sessions per decision 1.
- No edit or delete from the app. That stays in Notion.
- Rate hardcoded at 30, the one client's rate.

## Rule change: write to Notion

docs/05-api-routes.md and the app in general say this app is read-only and never writes
to Notion. Austin decided on 2026-07-16 to add one write path for clock sessions. This is
the new decision the read-only rule reserved for. The write is insert only, one Draft row
per clock out, behind the existing auth. It cannot update or delete existing rows.

## Testing

- vitest units for lib/clock.ts (Session ID format, hoursBetween including across
  midnight, elapsed formatting), mirroring lib/hours.test.ts and lib/selection.test.ts.
- A pure property-builder for the Notion insert, tested without hitting Notion.
