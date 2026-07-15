# 02 — Architecture

## Shape

```
Browser  ──►  Next.js route handler  ──►  Notion API
              (holds NOTION_TOKEN)         (source of truth)
```

One hop. The browser never talks to Notion, because Notion's API blocks cross-origin
browser requests and requires a secret. That constraint is the entire reason this is a
Next.js app and not the single HTML file it otherwise could be.

## Stack

| Choice | Why |
|---|---|
| Next.js App Router | Route handlers are the server hop. Nothing more is needed. |
| TypeScript | The Notion response shape is the main source of bugs. Type the boundary. |
| `@notionhq/client` | Official SDK. Handles pagination and auth. |
| Plain CSS | See below. |
| Vercel | Already in use. Zero config for this. |
| No database | See below. |

## Decisions

### Standalone, not inside Command Center

The Command Center is BBB agency tooling. AFP is an independent contract, not a BBB
client. Mixing them muddies whose revenue is whose, and that boundary should stay visible
if anyone ever reads the books.

Cost: a second Vercel project and a second auth boundary. Accepted.

### No Tailwind

The prototype's CSS is hand-written around print output. `@media print`, `@page`,
`break-inside`, and physical inch units are the actual product. Converting that to utility
classes buys nothing and puts the one thing that matters at risk. Lift the stylesheet.

### Rounding happens client-side

`Total Hours` in Notion carries floats like `5.833333333333333`. The API returns them raw
and the browser rounds, so the user can switch between exact, quarter-hour, and tenth-hour
and watch the invoice recompute.

Default is exact to two decimals, because AFP-2026-001 billed 16.45 hours exactly. That is
the established precedent with this client and changing it invites a question you do not
want to answer.

### Notion page URLs as session keys

Every session is keyed by its Notion page URL, which is stable and unique. Session IDs are
human-entered text and one typo makes two rows collide.

This is a different concern from the relation join described in `04-data-contract.md`,
where Work Done relations return page IDs rather than URLs and need dash-stripping to
match. Page URL as identity, page ID as join key: same underlying page, two different
representations depending on which Notion API surface returned it.

## Rejected

### Neon (or any Postgres)

Notion is already the database. Adding Postgres creates a second source of truth and a
sync problem, in exchange for nothing this tool currently needs. The dataset is eleven
rows queried twice a month.

What a database would legitimately buy, and the cheaper answer for each:

| Want | Cheaper answer |
|---|---|
| Invoice immutability | JSON snapshot on the Invoice Reports row. See below. |
| Invoice number uniqueness | One user, sequential numbers, server-side read before write. |
| Caching | 60s cache on the route handler. |
| PDF storage | Save the file. Put the link in the existing `PDF URL` property. |
| Audit history | Notion has page history. |

Revisit when any of these become true:

- More than one client, with different rates and terms.
- Real audit requirements, meaning someone other than you needs to reconstruct why an
  invoice says what it says.
- Notion latency becomes annoying in daily use.

At that point, Supabase is already in the stack and is Postgres. Adding Neon would make it
three infrastructure vendors for a one-user tool.

### The immutability problem, stated plainly

This is the one real defect in the current design and it is worth understanding before
deciding it can wait.

Invoices render live from Notion. Send AFP-2026-002 today, edit a Work Done
`Invoice Description` next week, regenerate the invoice, and you get a different document
than the one your client is holding. Nothing warns you. That is an accounting defect, not
a UI nit.

The fix is not a database. At invoice creation, serialize the rendered line items and
descriptions to JSON and store them on the Invoice Reports row. Render historical invoices
from that snapshot. The record of what you billed then lives next to the invoice that
billed it, which is where it belongs.

Deferred to Phase 6 because there is currently one invoice and it is still in draft. It
stops being deferrable the first time you edit a description after sending.
