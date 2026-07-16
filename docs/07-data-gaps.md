# 07 — Data gaps

Real defects in the source data, found while reading the workspace on 2026-07-15. Gap 1
blocks Phase 1. Gap 4 blocks sending a real invoice. The rest are handled by UI flags.

## 1. `Date` in Hours Worked is a text title property, not a date

**Closed 2026-07-16.** `Session Date`, a real date property, now exists on Hours Worked
and all 11 rows are backfilled, verified by a live query matching every row's `Date`
title against the new `date:Session Date:start` value, all 11 exact. The `Date` title
property is unchanged and stays as the human-readable label.

This was not blocking by the time it closed. Phase 1 shipped first with `date` sourced
from the title behind a single seam, plus a validator that hard-fails on any non-ISO
title rather than silently dropping a session. That seam should now be pointed at
`Session Date` instead of the title, a one-line change, but nothing is broken if that
swap hasn't happened yet, since all 11 titles and all 11 `Session Date` values agree.

Original problem, kept for context: the date filter worked only because every `Date`
title happened to be an ISO string that sorts lexically. One row entered as `7/15/26`
would have sorted before everything and silently dropped out of every invoice. That risk
is gone now that a real date type exists, but the validator from Phase 1 is worth keeping
regardless, entry is still manual and will drift again eventually.

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

**Partially closed 2026-07-16.** `Billing Address`, `AP Contact`, and `Payment Terms`
properties now exist on the Clients data source. `Billing Address` is filled in for
Anytime Fuel Pros: `18325 Bracken Dr, San Antonio, TX 78266`, confirmed with a live query
after writing it. `AP Contact` and `Payment Terms` are still empty, nobody has supplied
a contact name or confirmed terms yet, though the existing invoice AFP-2026-001 already
used Net 15 in practice, worth using as the default once someone decides to make it
official rather than incidental.

Still blocks sending a real invoice until AP Contact is filled in, since AP will not
process an invoice addressed to a company with no named contact. Once that's added, this
gap is fully closed.

The remit-to side is separate and does not go here: Battle Bound Branding LLC's address
is a repo constant per `09-brand.md`, since it is yours, not the client's, and doesn't
belong in Notion.

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
