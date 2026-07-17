# 08 — Deploy

## Environment

```
NOTION_TOKEN=              # internal integration secret, server-side only
APP_SECRET=                # single shared secret for auth

NOTION_DS_HOURS=d12d8e88-688d-4436-8bb6-99db181a5156
NOTION_DS_WORK=a6efbc39-846f-4675-962f-71e92ab3693f
NOTION_DS_INVOICES=7f996aea-c662-45d5-98a6-e66fe36e254c
NOTION_DS_CLIENTS=2dd5a6ee-7513-463c-b729-002e074c216a
NOTION_CLIENT_PAGE=3994259d-cffa-81e1-8b6a-e9fe91e93909
```

`NOTION_TOKEN` is never prefixed `NEXT_PUBLIC_` and never reaches the client bundle. Scope
it to read-only capabilities (see step 2 below). A leaked read-only token exposes your
billing history. It cannot rewrite it, because it was never granted that capability.

## Notion integration setup

1. Create an internal integration at notion.so/my-integrations.
2. Capabilities: **read content, insert content, and update content**. Leave delete off.
   - Read + insert cover the read path and the insert-only clock-out (one new Draft Hours
     Worked row, never a rewrite of existing billing records).
   - Update content was added 2026-07-17 for the cross-device clock (approach A): clock-in
     and clock-out set and clear two properties (`Active Clock Start`, `Active Clock
     Location`) on the Client page to hold the one shared running clock. This is the only
     thing update covers; it never touches Hours Worked billing rows. Without it, clock-in
     returns 502 with a hint pointing back here.
   - Delete stays off. A leaked token still cannot erase billing history.
3. **Share the integration with the `Invoice Details` page.** The three databases inherit
   access from the parent. The cross-device clock also writes the Client page, so the
   integration must have access to the Clients database (it already does, since the app
   reads it for the bill-to and rate).

Step 3 is the single most common first-run failure. Without it, every query returns an
empty result set with no error, and the app renders a working UI with no data in it, which
looks like a code bug and is not. The `GET` route should detect zero rows across all three
databases and say so explicitly.

Verified read access on 2026-07-15: the integration resolves `Invoice Details`, all three
databases, Clients, and Projects, and returns the expected row counts (11 / 5 / 1). If a
fresh integration returns zero rows, re-check step 3 before touching code.

## Auth

Required before the first deploy. Not after.

Without it, the production URL is your complete billing history and a Notion token with
write access to your workspace, reachable by anyone who guesses the subdomain.

Two workable options for a one-user tool:

**Vercel Deployment Protection.** Enable on the project. Check whether your plan covers
production deployments rather than previews only; the distinction matters and the answer
changes by plan.

**Middleware.** If Deployment Protection does not cover production on your plan, a
`middleware.ts` that checks a signed cookie against `APP_SECRET`, with a single password
form, is about twenty lines. Not elegant. Sufficient for one user and one client.

Do not reach for Auth.js or Clerk. There is one user and there will be one user.

## Vercel

Own project, not a subdirectory of the Command Center. Standard Next.js build, no config.

Set all env vars for Production and Preview. Preview deploys hit the same live Notion
workspace and the same live billing data, so treat preview URLs as production for the
purpose of who can reach them.

## Before the first real invoice

- [ ] Gap 1 fixed. `Session Date` exists and is backfilled.
- [ ] Gap 4 fixed. Billing identity is real, not placeholder text.
- [ ] Auth is live. Production URL returns 401 without credentials.
- [ ] An actual Cmd+P to PDF reviewed at full size. Read the whole thing. It is going to a
      client.
