# 05 — API routes

One route. Server-side. Behind auth.

This app is read-only for all billing history. Notion is updated by hand on the Notion side.
The one sanctioned exception, decided 2026-07-16, is the clock in/out feature: POST /api/clock
inserts a single Draft Hours Worked row per clock-out. It never updates or deletes, so it
cannot rewrite or remove existing billing records. That is the new decision this doc reserved
for. See docs/superpowers/specs/2026-07-16-clock-in-out-design.md.

## GET /api/notion/afp

Query the three data sources, join, return `Payload` per `04-data-contract.md`.

Cache 60 seconds. The dataset is eleven rows. Do not build an incremental sync, a webhook
listener, or a background job.

Failure modes worth handling explicitly:

- Empty results with no error almost always means the integration is not shared with the
  `Invoice Details` page. Detect zero rows across all three databases and return a message
  that says that, rather than rendering an empty invoice.
- Notion rate limits at roughly 3 requests per second. Three queries per load is fine.
  Do not query per-row.

### Auth

Required before the first deploy. See `08-deploy.md`.

## POST /api/clock

The one write route, added 2026-07-16 for the clock in/out feature. Insert only: it writes one
Draft Hours Worked row (start, end, raw hours, location, rate 30, Billable, Client relation)
per clock-out and never updates or deletes. Gated by the auth middleware like every non-open
path, so an unauthenticated call returns 401. On success it calls
`revalidatePath("/api/notion/afp")` so the new session shows on the next read rather than up to
60 seconds later, then returns 201. A bad payload returns 400 without touching Notion. A Notion
failure returns 502.

The Notion integration must have Insert content enabled for this to succeed, with Update
content and delete left off. See `08-deploy.md`.

## Caching

Reads are the whole advantage here, so cache aggressively and share the result across every
route rather than fetching per page. The one writer, POST /api/clock, revalidates this path on
success so a freshly clocked session is not hidden behind the cache. See Phase 0.5 in
`01-plan.md`.

## Not building

- Any write path beyond the insert-only POST /api/clock above. No `PATCH` or `DELETE`.
- Per-page Notion fetches. One fetch, joined once, shared.
