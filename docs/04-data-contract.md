# 04 — Data contract

`GET /api/notion/afp` returns `Payload`. This shape is identical to the `DATA` const at
the top of `prototype/invoice-builder.html`, so porting the UI means deleting that const
and fetching this instead. Nothing else in the prototype changes.

## Types

```ts
type Session = {
  url: string;          // Notion page URL. The stable key. Never use Session ID as a key.
  date: string;         // "2026-07-15"
  sid: string;          // Session ID, human-entered, display only
  start: string;        // normalized on read, see below
  end: string;
  brk: number | null;   // Break (min)
  hours: number;        // raw float from Total Hours, unrounded
  rate: number;
  billable: boolean;
  status: string;       // Billing Status, verbatim
  location: string | null;
  work: string[];       // Work Done page IDs, dashes stripped
  notes: string | null;
};

type WorkDone = {
  title: string;
  date: string;
  includeInInvoice: boolean;
  approval: string;     // Approval Status, verbatim
  summary: string;
  invoice: string;      // Invoice Description, the prose that prints
};

type Payload = {
  client: {
    name: string;
    defaultRate: number;
    timezone: string;
    billTo: string;     // see gap 4, currently a placeholder constant
  };
  from: string;         // remit-to block, see gap 4
  lastInvoice: {
    number: string;     // "AFP-2026-001"
    periodEnd: string;  // "2026-07-10"
  };
  hours: Session[];
  workDone: Record<string, WorkDone>;  // keyed by Notion page ID, dashes stripped
};
```

## Mapping rules

**Join keys.** `Session.work[]` holds Work Done page IDs and `workDone` is keyed by the
same IDs. Notion returns relations as arrays of page URLs and returns bare IDs elsewhere,
sometimes with dashes and sometimes without. Normalize both sides by extracting the ID and
stripping dashes before comparing. This is the single most likely source of a silent
mismatch.

**Hours stay raw.** Return `5.833333333333333` exactly as Notion has it. The browser
rounds. See the rounding decision in `02-architecture.md`.

**Checkboxes.** `__YES__` is true, `__NO__` is false, null is false.

**Times.** `Start Time` and `End Time` are inconsistent text (`7:00 AM` vs `07:00`).
Normalize to a single display format on read. Do not write corrections back to Notion.

**Location.** The literal string `Not specified` appears. Treat it as null for display
purposes, but pass it through so the UI decides.

**`lastInvoice`.** The Invoice Reports row with the highest `Invoice Number`, sorted as a
string. Used to default the date range to everything since the last invoice, and to
suggest the next number. If Invoice Reports is empty, return null and let the UI default
to the current month.

**`client.billTo` and `from`.** Not in Notion. Currently hardcoded placeholder constants
that the UI renders as editable blocks on the invoice. See gap 4.

## Sample

The `DATA` const in `prototype/invoice-builder.html` is a verbatim snapshot of all 11
hours rows and all 5 work done rows as of 2026-07-15, already in this shape, with one
exception.

**The fixture's join keys are not real Notion page IDs.** `work` arrays and the
`workDone` map use short slugs like `wd-0714` and `wd-0710` for readability. The real API
route must use actual Notion page IDs with dashes stripped, per the mapping rules above,
for example `39d4259dcffa805a8cc4ccf2cee57bfb` for the July 14 Work Done row, verified
live on 2026-07-15. Do not port the slug format. If a build reads this fixture and copies
`wd-0714`-style keys into the real join logic, every relation lookup against live Notion
will silently return nothing, since no real page ID looks like that.

The machine-readable fields, hours values, dates, statuses, rates, `brk`, `billable`,
`location`, are verbatim from Notion and safe to use as the fixture for testing the
mapping. If those fields drift from a live pull, the mapping is wrong, not the snapshot.

**The prose fields are not verbatim, confirmed live on 2026-07-16.** `invoice` and
`summary` in the fixture are an editorially cleaned approximation: curly quotes
straightened, em dashes flattened to CLAUDE.md's own no-em-dash rule, and some entries
truncated well below their real length, July 9's invoice description is 642 characters in
the fixture and 1548 live, a 2.4x difference. This is not a mapping bug and not stale
data, every Work Done row was last edited before the 2026-07-15 snapshot, someone hand-
edited the fixture prose for readability after copying it out of Notion. Do not use fixture
string length or punctuation to validate a mapping. Do use it to validate print CSS only
with real live-length prose substituted in, see `06-ui-spec.md`'s print section and
`01-plan.md` Phase 3.
