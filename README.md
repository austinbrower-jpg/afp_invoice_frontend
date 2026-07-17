# AFP Invoice Builder

A standalone internal tool that reads AFP contract work sessions from Notion, lets you
select a date range, and produces a print-ready invoice PDF including client-facing
descriptions of the work performed.

One client. One user. Not part of the Battle Bound Command Center by design: this bills an
independent contract, not a BBB client, and that boundary should stay visible.

## Status

**An app already exists.** This is a reskin and a performance fix, not a greenfield build.
The existing Client Reporting Portal has Dashboard, Clients, Invoice Details (Hours
Worked, Work Done, Invoice Reports, Invoice Dashboard, Report Builder), Work Stuff, and
Settings, plus a live timer. It is slow. These docs describe the target state, not the
current code. Read the existing repo before trusting any of them.

**Read-only, with one exception.** Notion is updated by hand on the Notion side. The only
write is the insert-only clock-out (`POST /api/clock`), which adds a single Draft Hours
Worked row and never updates or deletes; see `docs/05-api-routes.md`. Everything else only
reads, so the data can be cached hard because reads never invalidate it.

`prototype/invoice-builder.html` is the invoice generator: full UI, print CSS, and
calculation logic, seeded with a real Notion snapshot from 2026-07-15. Port it, do not
rebuild it.

`prototype/two-directions.html` compares two console visual directions side by side.
Station (pane A) is chosen, see `docs/10-visual-direction.md`.
`prototype/hours-worked-redesign.html` was an earlier exploration, superseded for visual
direction, but its data handling and range logic are still correct and worth lifting.

## Docs

Read in order. `01` and `02` are the decisions. `03` through `05` are the contract.

| Doc | What it covers |
|---|---|
| [01-plan.md](docs/01-plan.md) | Phases, build order, done criteria |
| [02-architecture.md](docs/02-architecture.md) | Stack, decisions made, options rejected and why |
| [03-notion-schema.md](docs/03-notion-schema.md) | Verified schema, read live 2026-07-15 |
| [04-data-contract.md](docs/04-data-contract.md) | The Payload type and mapping rules |
| [05-api-routes.md](docs/05-api-routes.md) | The single read route, caching, and failure modes |
| [06-ui-spec.md](docs/06-ui-spec.md) | What the interface does and why |
| [07-data-gaps.md](docs/07-data-gaps.md) | Known defects in the source data |
| [08-deploy.md](docs/08-deploy.md) | Env, auth, Vercel |
| [09-brand.md](docs/09-brand.md) | Logo assets, and whether BBB belongs on this invoice |
| [10-visual-direction.md](docs/10-visual-direction.md) | Chosen console theme (Station), and why |

`CLAUDE.md` holds the working rules for this repo.

## Open questions

Entity is decided: Battle Bound Branding LLC bills AFP. BBB branding and letterhead
belong on this invoice. See `09-brand.md`.

One thing still blocks a real invoice going out, and it is not code:

**The billing identity does not exist in Notion.** No remit-to, no AP contact, no
payment instructions. See gap 4 in `07-data-gaps.md`.

## Quickstart

```bash
npm install
cp .env.example .env.local   # fill in NOTION_TOKEN and APP_SECRET
npm run dev
```

Before anything works, the Notion integration must be shared with the `Invoice Details`
page. Without it, every query returns empty with no error. See `docs/08-deploy.md`.
