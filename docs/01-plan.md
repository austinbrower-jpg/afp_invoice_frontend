# 01 — Plan

## The job

Pick a date range. See every AFP work session in it. Select the ones to bill. Get a
print-ready invoice PDF that includes what you actually did during those hours.

This app is read-only. Notion is updated by hand on the Notion side after an invoice goes
out, marking billed sessions `Invoiced`. See Phase 4 and `05-api-routes.md`.

Everything else is optional.

## Phases

Each phase has a done criterion. Do not start the next one until it is met.

### Phase 0 — Scaffold

Next.js App Router, TypeScript, `@notionhq/client`. Own repo, own Vercel project.

Done when: `npm run dev` serves an empty page and `.env.example` exists.

### Phase 0.5 — Diagnose the lag

The existing app is slow. This is a separate problem from the redesign, and the redesign
will not fix it. Diagnose before changing anything.

Likeliest cause: each route fetches Notion on mount with no shared cache, and relations
resolve per-row, producing an N+1 against an API that rate-limits at roughly 3 requests
per second. Eleven rows becomes dozens of round trips on every navigation.

Read-only means the fix is cheap. One server-side fetch, joined once, cached, shared
across every route. Nothing invalidates because nothing writes.

Done when: the cause is named with evidence from the network tab or a trace, not guessed.

### Phase 1 — Read path

`GET /api/notion/afp`. Query the three data sources, join hours to work done, return the
`Payload` shape from `04-data-contract.md`.

This is the phase where the build actually gets decided. If the relation IDs do not line
up the way the contract assumes, everything downstream is wrong. Log the raw Notion
response and eyeball the join before writing a single line of UI.

Done when: the route returns 11 hours rows and 5 work done rows, every hours row with a
`Related Work Done` link resolves to a real work done entry, and `lastInvoice` reports
`AFP-2026-001` / `2026-07-10`.

### Phase 2 — UI port

Lift `prototype/invoice-builder.html` into the page component. Delete the `DATA` const,
fetch the route instead. The rest of that file is already correct.

Done when: the page renders the same invoice the prototype does, from live data.

### Phase 3 — Print verification

The `@media print` block is the deliverable. Everything else is scaffolding around it.

Done when: an actual Cmd+P to PDF produces a clean letter-size document with the console
stripped, no orphaned section headers, and no work entry split across a page break.

### Phase 4 — Cut, not added

There is no write-back. Notion is updated by hand on the Notion side. No POST route, no
double-billing guard, no partial-failure reconciliation. The app reads and renders.

The `Invoiced` and `Superseded` statuses still matter, but only for display and filtering.

### Phase 5 — Auth and deploy

Done when: the production URL returns 401 without credentials. Not before.

### Phase 6 — Snapshot immutability (later)

Currently a sent invoice can silently change if someone edits a Work Done description
afterward. Fix by storing a JSON snapshot of the rendered line items and descriptions on
the Invoice Reports row at creation time, and rendering historical invoices from the
snapshot rather than from live Notion data.

Not urgent at one invoice. Becomes urgent the first time you edit a description after
sending. See `02-architecture.md`.

## Prerequisites

Fix Gap 1 in `07-data-gaps.md` before Phase 1. The date range feature currently rests on a
lexical string sort of a text property. Everything in this app depends on that filter
being correct.

## Explicitly not building

- Client switcher. There is one client.
- Invoice emailing. You send it yourself.
- Payment tracking beyond the `Status` field Notion already has.
- Time entry. Hours get logged in Notion. This tool reads.
- A database. See `02-architecture.md`.
