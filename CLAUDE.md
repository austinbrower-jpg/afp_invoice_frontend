# Working rules

Project context lives in `README.md` and `docs/`. Read `docs/01-plan.md` and
`docs/03-notion-schema.md` before writing code. The schema in that doc was read live from
the workspace and is correct. Do not guess at Notion property names.

## Hard rules

- `NOTION_TOKEN` is server-side only. Never `NEXT_PUBLIC_`. Never reaches the client
  bundle. If a component needs Notion data, it comes through an API route.
- This app is read-only. It never writes to Notion. If a task seems to need a write, stop
  and ask rather than adding one.
- Do not deploy before auth exists. See `docs/08-deploy.md`.
- Do not add a database before caching has been tried and measured. See the Neon section
  in `docs/02-architecture.md`. Notion is the source of truth for this tool.

## Conventions

- Port `prototype/invoice-builder.html`, do not rebuild it. The UI, the calculation logic,
  and especially the `@media print` block are already correct and tested. Lift them.
- The console theme is Station, decided in `docs/10-visual-direction.md`, demonstrated in
  `prototype/two-directions.html` pane A. Build Station. Do not build Depth (pane B) or the
  earlier greenbar direction in `prototype/hours-worked-redesign.html`. That file's data
  handling and date-range logic are still correct and worth lifting; its visual design is
  not.
- The paper (the invoice PDF) and the console (everything else) are two different design
  systems on purpose. See `docs/10-visual-direction.md`. Do not unify their tokens.
- No Tailwind. The prototype's CSS is hand-written around print output and converting it
  buys nothing and risks the deliverable. Global stylesheet or CSS module.
- All hour rounding happens client-side so the user can change the rule and watch the
  invoice update. The API returns raw floats from Notion.
- Notion page IDs are the join keys. Strip dashes on both sides before comparing. The API
  returns them inconsistently.
- Verify the join by logging the raw Notion response before building UI on top of it.
- Brand assets: import only from `public/brand/`. Never from `brand-assets/`, which is
  reference and must stay out of the bundle. Use the PNGs. The SVGs in the pack are
  embedded rasters in a vector wrapper and are worse in every way. See `docs/09-brand.md`.
- The `#6366f1` accent is the AFP client's color from Notion, not a BBB color. Do not
  swap it for brand colors.

## Writing

- No em dashes in code comments, docs, commit messages, or generated output.
- Markdown stays clean and vault-compatible: standard headings, no HTML, no nested tables.
- Interface copy is plain and active. The button says what happens: "Save PDF", not
  "Export". "Mark invoiced", not "Submit".

## Scope discipline

This is a one-user tool that bills one client roughly twice a month over eleven database
rows. If a proposed abstraction would only pay off at ten clients, it does not belong here
yet. Build the thing that works now and leave the seam visible.
