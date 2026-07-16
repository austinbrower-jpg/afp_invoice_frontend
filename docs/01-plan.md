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

### Phase 0.5 — Lag cause, already diagnosed, closed

Diagnosed live against the production deployment on 2026-07-16, not guessed. Notion
rate-limits at roughly 3 requests per second. Routes that resolve many relations serially,
the Clients row alone resolves 17, collapse under concurrent load: sequential requests
ran at roughly 109ms median, the same routes under a 16-way concurrent burst hit up to
7628ms, a production log captured the exact failure as `DataProviderError: ... rate
limited`. This holds true against the deploy that already fixed the separate prefetch
storm bug, so the relation fan-out is the real, independent cause, not a side effect of
that other bug.

This phase is closed. Do not reopen it by re-auditing the old app's code, git history, or
further deploys, that evidence-gathering already happened and the cause is named. The fix
is Phase 1's architecture: one server-side fetch, joined once, cached, shared across every
route, per `02-architecture.md`. That design does not resolve relations per-row under
concurrent load, so it does not inherit this failure mode by construction, not by further
diagnosis.

If the new app is slow after Phase 5 ships to Vercel, that is a new investigation against
the new app's own traces and its own code. It is not a continuation of this one, and nothing
here should be assumed to still apply to a codebase this different.

Done: cause named with live evidence, see above. Move to Phase 1.

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

Gap 1 in `07-data-gaps.md` is closed as of 2026-07-16, a real `Session Date` property
exists and all 11 rows are backfilled and verified. It did not end up blocking Phase 1 in
practice, Phase 1 shipped against the title behind a seam with a hard-fail validator, per
CLAUDE.md's stop-and-ask rule on writes. Point that seam at `Session Date` when
convenient.

## Explicitly not building

- Client switcher. There is one client.
- Invoice emailing. You send it yourself.
- Payment tracking beyond the `Status` field Notion already has.
- Time entry. Hours get logged in Notion. This tool reads.
- A database. See `02-architecture.md`.
