# 03 — Notion schema

Read live from the workspace on 2026-07-15. Re-verified live the same day via a second
pass, which caught two properties missing from the first read (`Sent Date` and
`Paid Date` on Invoice Reports, `Notes` on Clients), now included below. Property names
and types are exact. Do not guess at these.

All three databases live under `AFP-Work / Invoice Details`
(page `3984259dcffa81d480e5fd486440f230`).

## IDs

| Database | Database ID | Data source ID |
|---|---|---|
| Hours Worked | `a192465a4bbe442e86a5255db6d65df6` | `d12d8e88-688d-4436-8bb6-99db181a5156` |
| Work Done | `69e74fe8dcba48cc92a75ede949342e6` | `a6efbc39-846f-4675-962f-71e92ab3693f` |
| Invoice Reports | `648e126058eb431d9ca9da7c0088f8ef` | `7f996aea-c662-45d5-98a6-e66fe36e254c` |
| Clients | not read | `2dd5a6ee-7513-463c-b729-002e074c216a` |
| Projects | not read | `65732f93-2c35-4e61-8d9e-4e2e8941e069` |

AFP client page ID: `3994259d-cffa-81e1-8b6a-e9fe91e93909`. Default rate 30. One client
exists. Do not build a switcher.

## Hours Worked

11 rows as of 2026-07-15, spanning July 8 through July 15.

| Property | Type | Notes |
|---|---|---|
| `Date` | **title** | Text, not a date type. Holds ISO `YYYY-MM-DD`. See gap 1. |
| `Session ID` | text | e.g. `AFP-2026-07-15-0700-1438` |
| `Start Time` | text | Inconsistent: `7:00 AM` and `07:00` both appear |
| `End Time` | text | Same |
| `Break (min)` | number | Often null |
| `Total Hours` | number | Float, up to 13 decimal places |
| `Hourly Rate` | number (dollar) | 30 on every billable row |
| `Billable` | checkbox | |
| `Billing Status` | select | Draft, Reviewed, Ready to Invoice, Invoiced, Paid, Superseded |
| `Location` | text | Sometimes the literal string `Not specified` |
| `Notes` | text | Internal and verbose. Not for print unless the user picks the notes detail mode. |
| `Migration Key` | text | Ignore |
| `Client` | relation → Clients | |
| `Project` | relation → Projects | |
| `Related Work Done` | relation → Work Done | The join for invoice descriptions |
| `Invoice Report` | relation → Invoice Reports | Written on invoice creation |

Status meanings in practice:

- `Superseded` means a merged or corrected duplicate. Never bill. One row
  (`AFP-2026-07-08-004`) is explicitly marked DO NOT BILL in its notes.
- `Invoiced` means it is already on AFP-2026-001. Never bill again.
- `Ready to Invoice` and `Reviewed` are both billable.

## Work Done

5 rows. This is where client-facing prose lives.

| Property | Type | Notes |
|---|---|---|
| `Title` | title | |
| `Date` | **date** | Real date type, unlike Hours Worked |
| `Work Log ID` | text | |
| `Summary` | text | Short. Mixed internal and external voice. |
| `Invoice Description` | text | **The client-facing prose. This is what prints.** |
| `Detailed Work Description` | text | |
| `Internal Notes` | text | Never print |
| `Include in Invoice` | checkbox | |
| `Include in Work Report` | checkbox | |
| `Client Visible` | checkbox | |
| `Approval Status` | select | Draft, Needs Review, Approved, Sent to Client, Archived |
| `Status` | select | not-started, in-progress, blocked, done |
| `Priority` | select | low, medium, high, urgent |
| `Evidence Links` | text | |
| `GitHub Link` | url | |
| `Related Hours` | relation → Hours Worked | |
| `Invoice Report` | relation → Invoice Reports | |

## Invoice Reports

1 row: `AFP-2026-001`, period 2026-07-08 to 2026-07-10, 16.45 hours, $493.50, status draft.

| Property | Type | Notes |
|---|---|---|
| `Invoice Number` | title | Format `AFP-YYYY-NNN` |
| `Invoice Date` | date | |
| `Due Date` | date | |
| `Period Start` | date | |
| `Period End` | date | |
| `Sent Date` | date | Missed on the first schema read. Empty on the one existing row. |
| `Paid Date` | date | Missed on the first schema read. Empty on the one existing row. |
| `Total Hours` | number | |
| `Total Amount` | number (dollar) | |
| `Hourly Rate` | number (dollar) | |
| `Payment Terms` | text | e.g. `Net 15` |
| `Status` | select | draft, sent, paid, void |
| `Summary` | text | |
| `PDF URL` | url | Unused. Reuse it for the saved PDF. |
| `Client` | relation → Clients | |
| `Included Hours` | relation → Hours Worked | |
| `Included Work Done` | relation → Work Done | |

## Clients

| Property | Type |
|---|---|
| `Name` | title |
| `Default Hourly Rate` | number |
| `Timezone` | text (`America/Chicago`) |
| `Status` | select |
| `Color` | text (`#6366f1`, used as the accent in the prototype) |
| `Notes` | text, missed on the first schema read. Holds a migration provenance note on the AFP row, not billing-relevant. |
| `Migration Key` | text, ignore, same as Hours Worked and Work Done. |
| relations | Hours Worked, Work Done, Projects, Invoice Reports |

No billing address, AP contact, or payment instructions exist on this row. See gap 4.

## Date property expansion

Date properties expand into three columns when queried:

```
date:Invoice Date:start        ISO string
date:Invoice Date:end          null for single dates
date:Invoice Date:is_datetime  0 or 1
```

Checkboxes serialize as `__YES__` and `__NO__`, and null means false.

Relations come back as JSON arrays of page URLs, not bare IDs.
