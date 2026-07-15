# 05 — API routes

One route. Server-side. Behind auth.

This app is read-only. Notion is updated by hand on the Notion side, so there is no write
path, no double-billing guard, and no partial-failure handling. If a future version needs
to write, that is a new decision, not an extension of this one.

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

## Caching

Read-only is the whole advantage here. Nothing this app does can invalidate the data, so
cache aggressively and share the result across every route rather than fetching per page.
That is most likely the entire fix for the lag. See Phase 0.5 in `01-plan.md`.

## Not building

- Any write path. The app reads.
- `PATCH`, `POST`, or `DELETE` of any kind.
- Per-page Notion fetches. One fetch, joined once, shared.
