# 07 — Data gaps

Real defects in the source data, found while reading the workspace on 2026-07-15. Gap 1
blocks Phase 1. Gap 4 blocks sending a real invoice. The rest are handled by UI flags.

## 1. `Date` in Hours Worked is a text title property, not a date

**Blocking.** Fix before Phase 1.

The whole app filters sessions by date range. That filter currently works only because
every `Date` value happens to be an ISO string and ISO strings sort lexically. One row
entered as `7/15/26` sorts before everything and silently drops out of every invoice. No
error, no flag, just a session you never billed for.

Fix: add a real `Session Date` date property to Hours Worked, backfill all 11 rows from
the existing titles, and filter on that. Keep the title as the human-readable label.

## 2. A session with no linked Work Done row

`AFP-2026-07-15-0700-1438`, 7.63 hours, has no `Related Work Done` relation. It bills as
an hours line with no description in the detail section, which is the exact thing this
tool exists to prevent.

The notes on that session are substantial and could be lifted into a Work Done row.

Flagged in the UI. Not blocking.

## 3. July 14 Work Done is not invoice-ready

Work Done `July 14, 2026` has `Include in Invoice` unchecked and Approval Status
`Needs Review`, while its three sessions (6.54 hours total) are all `Reviewed` and
otherwise billable.

So the hours are ready and the description is not. Either approve the description or drop
the sessions. Do not bill 6.54 hours with a description you have not reviewed.

Flagged in the UI. Not blocking.

## 4. No billing identity anywhere

**Blocks sending a real invoice.** Narrower than it was: the entity question in
`09-brand.md` is decided (Battle Bound Branding LLC), so the remit-to side is a known
constant, not an unknown. What is still missing is AFP's side.

Nothing in Notion stores:

- AFP's billing address and AP contact
- Payment instructions

The prototype makes those blocks editable directly on the paper as a stopgap, and the
edits do not persist. That is fine for testing and wrong for a document you send twice a
month.

Fix: add `Billing Address`, `AP Contact`, and `Payment Terms` properties to the Client row
in Notion. Verified live on 2026-07-15: the Client row (`Anytime Fuel Pros`) currently
has no such properties, only `Name`, `Default Hourly Rate`, `Timezone`, `Status`, `Color`,
and `Notes`. Keep the BBB remit-to block as a constant in the repo since it is yours, not
the client's, and does not belong in Notion.

## 5. Inconsistent time formats

`Start Time` and `End Time` mix `7:00 AM` and `07:00` across rows. Normalize on read.
Do not write corrections back to Notion, since the source of the inconsistency is manual
entry and it will just drift again.

## 6. Float precision

`Total Hours` carries values like `5.833333333333333` and `7.6333`. Both appear in the same
database, so some rows were computed and some were typed.

Not a bug, but note that AFP-2026-001 billed 16.45 hours exactly, which is the unrounded
sum. **Exact to two decimals is the established precedent with this client.** Quarter-hour
rounding is available as an option and is not the default, because changing your rounding
rule mid-contract invites a question you do not want to answer.

## 7. `Location` sometimes says "Not specified"

The literal string, not a null. Treat as null for display.
