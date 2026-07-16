# AFP Station Cockpit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the separate dashboard and invoice-builder screens into one unified Station cockpit at `/`, add an earnings-by-week instrument, and prepare it to be hosted on Vercel behind the existing auth.

**Architecture:** Restructure in place. The Notion read path, auth, invoice math, and the tested print CSS stay exactly as they are. The 687-line `app/page.tsx` and the `app/dashboard/Dashboard.tsx` screen are decomposed into focused components that a new cockpit page composes into layout A (instrument cluster on top, session-plus-earnings and the live invoice paper split below). Both screens already read the same `Payload`, so this removes a seam rather than adding a source of truth.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, `@notionhq/client`, hand-written CSS (no Tailwind). Tests run on Vitest in a Node environment, asserting pure logic directly and rendering presentational components with `react-dom/server` (no new UI-test dependency).

## Global Constraints

Every task's requirements implicitly include this section. Values are copied from the spec and `CLAUDE.md`.

- `NOTION_TOKEN` is server-side only. It never gets a `NEXT_PUBLIC_` prefix and never reaches the client bundle. Notion data reaches the client only through `GET /api/notion/afp`.
- Read-only. Never write to Notion. If a task seems to need a write, stop and ask.
- Do not rebuild `prototype/invoice-builder.html` logic or the `@media print` block in `app/globals.css`. Port and reuse them.
- The console (`.station` tokens) and the paper (`.paper` tokens) are two separate design systems. Do not unify their tokens. No hardcoded hex in components; use the CSS custom properties.
- No Tailwind. Styles live in `app/globals.css`.
- All hour rounding happens client-side. The API returns raw floats.
- Notion page IDs are join keys; dashes are already stripped by `toPageId` in `lib/notion.ts`. Reuse it, do not re-implement.
- Brand assets import only from `public/brand/`, PNGs only. The `#6366f1` accent is the AFP client color, not a BBB color.
- No em dashes in code, comments, docs, or commit messages. Interface copy is plain and active ("Save PDF", "Mark invoiced").
- Performance line: no persistent render loop, no canvas, no 3D, no particle or physics library. Bounded one-shot CSS transitions are fine. Every animation drops out under `prefers-reduced-motion`, which `app/globals.css` already enforces globally at the bottom of the file.
- Responsive down to a single column under 1100px. Visible keyboard focus. No browser storage of any kind.

## Shared interfaces defined by this plan

Types added or relied on across tasks. Later tasks consume these exact names.

- Existing (in `lib/notion.ts`, do not redefine): `Session`, `WorkDone`, `Payload`.
- New in `lib/hours.ts` (Task 3): `WeekEarning = { weekStart: string; hours: number; amount: number; collected: number; owed: number; isCurrent: boolean }`, and `weeklyEarnings(payload: Payload, today: string, weeks?: number): WeekEarning[]`.
- New in `lib/selection.ts` (Task 2): `Mode = "invoice" | "summary" | "notes" | "none"`, `BILLED_STATUSES: Set<string>`, `byDayDesc(a, b)`, `inRange(r, from, to)`, `isTerminal(status)`, `unbilledStart(data, today)`, `eligible(r, showall)`, `autoSelect(hours, from, to, showall)`, `buildFlags(data, rows)`.

---

## Task 1: Test harness

**Files:**
- Modify: `package.json` (add devDependency and `test` script)
- Create: `vitest.config.ts`
- Create: `lib/hours.test.ts` (one real starter assertion against existing code)

**Interfaces:**
- Consumes: nothing.
- Produces: a working `npm test` that later tasks extend.

- [ ] **Step 1: Add Vitest as a dev dependency and a test script**

Edit `package.json`. Add to `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Add to `devDependencies`:

```json
"vitest": "^2.1.8"
```

- [ ] **Step 2: Install**

Run: `npm install`
Expected: completes, `node_modules/.bin/vitest` exists.

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Node environment: the pure logic needs no DOM, and presentational components are
// checked with react-dom/server's renderToStaticMarkup, which is also DOM-free. The
// alias mirrors the "@/..." paths tsconfig defines so tests import the same way the app does.
export default defineConfig({
  test: { environment: "node" },
  resolve: { alias: { "@": resolve(__dirname, ".") } },
});
```

- [ ] **Step 4: Write a starter test that exercises existing code**

Create `lib/hours.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { startOfWeekISO } from "@/lib/hours";

describe("startOfWeekISO", () => {
  it("anchors to the Monday of the week", () => {
    // 2026-07-15 is a Wednesday; its Monday is 2026-07-13.
    expect(startOfWeekISO("2026-07-15")).toBe("2026-07-13");
  });
});
```

- [ ] **Step 5: Run it**

Run: `npm test`
Expected: 1 passing test.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts lib/hours.test.ts
git commit -m "Add Vitest harness with a Node test environment"
```

---

## Task 2: Extract selection and flag helpers to lib/selection.ts

The invoice-builder helpers currently live at the bottom of `app/page.tsx` (lines 594-687). Moving them to a module shrinks the page, and makes the money-critical eligibility and flag logic unit-testable. Behavior does not change: `/` is still the invoice builder after this task.

**Files:**
- Create: `lib/selection.ts`
- Create: `lib/selection.test.ts`
- Modify: `app/page.tsx` (remove the moved helpers, import them instead)

**Interfaces:**
- Consumes: `Session`, `Payload` from `lib/notion`; `addDays` from `lib/invoice`.
- Produces: `Mode`, `BILLED_STATUSES`, `byDayDesc`, `inRange`, `isTerminal`, `unbilledStart`, `eligible`, `autoSelect`, `buildFlags`.

- [ ] **Step 1: Write failing tests**

Create `lib/selection.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  inRange,
  isTerminal,
  eligible,
  autoSelect,
  unbilledStart,
  buildFlags,
} from "@/lib/selection";
import type { Session, Payload } from "@/lib/notion";

const s = (over: Partial<Session>): Session => ({
  url: "u",
  date: "2026-07-14",
  sid: "AFP-1",
  start: "7:00 AM",
  end: "9:00 AM",
  brk: null,
  hours: 2,
  rate: 30,
  billable: true,
  status: "Reviewed",
  location: null,
  work: [],
  notes: null,
  ...over,
});

describe("eligibility and selection", () => {
  it("isTerminal covers Invoiced, Paid, Superseded only", () => {
    expect(isTerminal("Invoiced")).toBe(true);
    expect(isTerminal("Paid")).toBe(true);
    expect(isTerminal("Superseded")).toBe(true);
    expect(isTerminal("Reviewed")).toBe(false);
  });

  it("eligible hides non-billable and superseded unless showall", () => {
    expect(eligible(s({ billable: false }), false)).toBe(false);
    expect(eligible(s({ status: "Superseded" }), false)).toBe(false);
    expect(eligible(s({ billable: false }), true)).toBe(true);
  });

  it("autoSelect picks billable, in-range, non-terminal rows", () => {
    const rows = [
      s({ url: "a", date: "2026-07-14", status: "Reviewed" }),
      s({ url: "b", date: "2026-07-14", status: "Paid" }),
      s({ url: "c", date: "2026-07-01", status: "Reviewed" }),
    ];
    const picked = autoSelect(rows, "2026-07-13", "2026-07-15", false);
    expect(picked.has("a")).toBe(true);
    expect(picked.has("b")).toBe(false); // Paid is terminal
    expect(picked.has("c")).toBe(false); // out of range
  });

  it("inRange is inclusive on both ends", () => {
    expect(inRange(s({ date: "2026-07-13" }), "2026-07-13", "2026-07-15")).toBe(true);
    expect(inRange(s({ date: "2026-07-16" }), "2026-07-13", "2026-07-15")).toBe(false);
  });

  it("unbilledStart is the day after the last invoice period", () => {
    const data = { lastInvoice: { number: "AFP-2026-001", periodEnd: "2026-07-10" } } as Payload;
    expect(unbilledStart(data, "2026-07-16")).toBe("2026-07-11");
  });

  it("unbilledStart falls back to month start with no usable last invoice", () => {
    const data = { lastInvoice: null } as Payload;
    expect(unbilledStart(data, "2026-07-16")).toBe("2026-07-01");
  });

  it("buildFlags names a session with no linked Work Done", () => {
    const data = { workDone: {}, lastInvoice: null } as unknown as Payload;
    const flags = buildFlags(data, [s({ sid: "AFP-9", work: [] })]);
    expect(flags.join(" ")).toContain("AFP-9");
    expect(flags.join(" ")).toContain("no linked Work Done");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test lib/selection.test.ts`
Expected: FAIL, cannot resolve `@/lib/selection`.

- [ ] **Step 3: Create `lib/selection.ts` by moving the helpers**

Move the following from `app/page.tsx` verbatim into `lib/selection.ts`, add `export` to each, and add the two imports at the top. This is the block currently at `app/page.tsx` lines 596-687 plus the `Mode` type at line 28.

```ts
// Selection, eligibility, and flag logic lifted from app/page.tsx so it is unit-testable and
// shared by the cockpit. Pure functions over the Payload shape. buildFlags returns escaped
// HTML strings on purpose: the caller renders them with dangerouslySetInnerHTML so the bolded
// session ids and status words survive. See docs/06-ui-spec.md.

import type { Payload, Session } from "@/lib/notion";
import { addDays } from "@/lib/invoice";

export type Mode = "invoice" | "summary" | "notes" | "none";

export const byDayDesc = (a: Session, b: Session) =>
  b.date.localeCompare(a.date) || a.sid.localeCompare(b.sid);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const inRange = (r: Session, from: string, to: string) =>
  r.date >= from && r.date <= to;

// Statuses that must never land on a new invoice. Invoiced and Paid are already on an
// invoice, so re-billing either double bills; Superseded is a dead duplicate. One set so
// eligible, autoSelect, the row lock, and buildFlags cannot drift apart.
export const BILLED_STATUSES = new Set(["Invoiced", "Paid"]);
export const isTerminal = (status: string): boolean =>
  BILLED_STATUSES.has(status) || status === "Superseded";

// The day after the last invoice's period, or the month start when there is no last invoice
// or its Period End is empty or unreadable. Guarding the date keeps addDays from emitting a
// "NaN-NaN-NaN" range that would sort every session out and pre-select nothing.
export const unbilledStart = (data: Payload, today: string): string =>
  data.lastInvoice && ISO_DATE.test(data.lastInvoice.periodEnd)
    ? addDays(data.lastInvoice.periodEnd, 1)
    : today.slice(0, 8) + "01";

// Eligible means Billable is true and the status is not Superseded. The toggle reveals the
// excluded rows greyed rather than hiding them, because a missing session should never look
// like data loss. Invoiced and Paid rows stay visible but locked.
export const eligible = (r: Session, showall: boolean) =>
  showall ? true : r.billable && r.status !== "Superseded";

export function autoSelect(hours: Session[], from: string, to: string, showall: boolean) {
  const next = new Set<string>();
  hours
    .filter((r) => inRange(r, from, to) && eligible(r, showall))
    .filter((r) => r.billable && !isTerminal(r.status))
    .forEach((r) => next.add(r.url));
  return next;
}

// The panel names specific problems in the current selection, not generic warnings.
export function buildFlags(data: Payload, rows: Session[]): string[] {
  const f: string[] = [];
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  rows
    .filter((r) => !r.work.length)
    .forEach((r) =>
      f.push(
        `<b>${esc(r.sid)}</b> has no linked Work Done row, so it will appear as a line item with no description in the detail section.`
      )
    );
  [...new Set(rows.flatMap((r) => r.work))].forEach((id) => {
    const w = data.workDone[id];
    if (!w) return;
    if (!w.includeInInvoice)
      f.push(
        `Work Done "<b>${esc(w.title)}</b>" has <b>Include in Invoice</b> unchecked in Notion but its hours are selected. Check the box or drop those sessions.`
      );
    if (w.approval !== "Approved")
      f.push(`Work Done "<b>${esc(w.title)}</b>" is still <b>${esc(w.approval)}</b>, not Approved.`);
  });
  rows
    .filter((r) => BILLED_STATUSES.has(r.status))
    .forEach((r) =>
      f.push(
        `<b>${esc(r.sid)}</b> is already marked <b>${esc(r.status)}</b>${
          data.lastInvoice ? ` (on ${esc(data.lastInvoice.number)})` : ""
        }. Double billing risk.`
      )
    );
  rows
    .filter((r) => r.status === "Superseded")
    .forEach((r) =>
      f.push(
        `<b>${esc(r.sid)}</b> is <b>Superseded</b>, a dead duplicate that must not be billed.`
      )
    );
  rows
    .filter((r) => r.hours <= 0)
    .forEach((r) =>
      f.push(
        `<b>${esc(r.sid)}</b> has no hours logged (Total Hours is empty or zero), so it prints as a $0.00 line.`
      )
    );
  rows
    .filter((r) => !r.billable)
    .forEach((r) => f.push(`<b>${esc(r.sid)}</b> is marked non-billable.`));
  return f;
}
```

- [ ] **Step 4: Update `app/page.tsx` to import instead of declare**

Delete lines 594-687 (the `/* helpers, lifted from the prototype */` block) and the local `type Mode` at line 28. Add this import near the other imports at the top:

```ts
import {
  autoSelect,
  buildFlags,
  byDayDesc,
  eligible,
  inRange,
  isTerminal,
  unbilledStart,
  type Mode,
} from "@/lib/selection";
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test lib/selection.test.ts && npm run typecheck`
Expected: selection tests PASS, typecheck clean (no unused or missing symbols in `app/page.tsx`).

- [ ] **Step 6: Commit**

```bash
git add lib/selection.ts lib/selection.test.ts app/page.tsx
git commit -m "Extract invoice selection and flag helpers into lib/selection"
```

---

## Task 3: weeklyEarnings in lib/hours.ts

**Files:**
- Modify: `lib/hours.ts` (append the new type and function)
- Modify: `lib/hours.test.ts` (add cases)

**Interfaces:**
- Consumes: `Payload`, `Session` from `lib/notion`; `isLive`, `startOfWeekISO`, `BILLED_STATUSES` already in `lib/hours.ts`. Note `lib/hours.ts` already declares its own `BILLED_STATUSES` at line 179; reuse that one, do not import from `lib/selection`.
- Produces: `WeekEarning`, `weeklyEarnings`.

- [ ] **Step 1: Write failing tests**

Add to `lib/hours.test.ts`:

```ts
import { weeklyEarnings } from "@/lib/hours";
import type { Payload, Session } from "@/lib/notion";

const wk = (over: Partial<Session>): Session => ({
  url: "u", date: "2026-07-14", sid: "AFP", start: "7:00 AM", end: "9:00 AM",
  brk: null, hours: 2, rate: 30, billable: true, status: "Reviewed",
  location: null, work: [], notes: null, ...over,
});

describe("weeklyEarnings", () => {
  const payload = (hours: Session[]): Payload => ({
    client: { name: "AFP", defaultRate: 30, timezone: "", billTo: "" },
    from: "", lastInvoice: null, hours, workDone: {},
  });

  it("groups by Monday-anchored week and splits collected from owed", () => {
    const data = payload([
      wk({ url: "a", date: "2026-07-08", hours: 5.83, status: "Invoiced" }), // wk Jul 06, collected
      wk({ url: "b", date: "2026-07-14", hours: 6.54, status: "Reviewed" }),  // wk Jul 13, owed
      wk({ url: "c", date: "2026-07-15", hours: 7.63, status: "Reviewed" }),  // wk Jul 13, owed
    ]);
    const weeks = weeklyEarnings(data, "2026-07-16", 6);
    const jul13 = weeks.find((w) => w.weekStart === "2026-07-13")!;
    const jul06 = weeks.find((w) => w.weekStart === "2026-07-06")!;
    expect(jul13.owed).toBeCloseTo((6.54 + 7.63) * 30, 5);
    expect(jul13.collected).toBe(0);
    expect(jul13.amount).toBeCloseTo(jul13.owed, 5);
    expect(jul13.isCurrent).toBe(true); // Monday of 2026-07-16 is 2026-07-13
    expect(jul06.collected).toBeCloseTo(5.83 * 30, 5);
    expect(jul06.owed).toBe(0);
    expect(jul06.isCurrent).toBe(false);
  });

  it("excludes superseded and non-billable from the money", () => {
    const data = payload([
      wk({ url: "a", date: "2026-07-14", hours: 4, status: "Superseded" }),
      wk({ url: "b", date: "2026-07-14", hours: 3, billable: false }),
      wk({ url: "c", date: "2026-07-14", hours: 2, status: "Reviewed" }),
    ]);
    const weeks = weeklyEarnings(data, "2026-07-16", 6);
    const jul13 = weeks.find((w) => w.weekStart === "2026-07-13")!;
    expect(jul13.amount).toBeCloseTo(2 * 30, 5); // only the Reviewed billable row
  });

  it("returns the current week even when empty, newest first", () => {
    const data = payload([wk({ date: "2026-06-01", hours: 2, status: "Paid" })]);
    const weeks = weeklyEarnings(data, "2026-07-16", 6);
    expect(weeks[0].weekStart).toBe("2026-07-13"); // current week, at rest
    expect(weeks[0].amount).toBe(0);
    expect(weeks[0].isCurrent).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test lib/hours.test.ts`
Expected: FAIL, `weeklyEarnings` is not exported.

- [ ] **Step 3: Implement `weeklyEarnings`**

Append to `lib/hours.ts`:

```ts
/* ---------- weekly earnings ---------- */

// One row per calendar week for the earnings-by-week instrument. amount is collected + owed.
// collected is money already on an invoice (Invoiced or Paid); owed is billable money not yet
// invoiced. This is deliberately simpler than unbilled() above: it reports what was earned in
// each week split by invoice state, and applies no date-window bound. The two answer different
// questions and are not expected to match. See docs/superpowers/specs/2026-07-16-afp-station-cockpit-design.md.
export type WeekEarning = {
  weekStart: string; // ISO Monday
  hours: number; // billable, non-superseded
  amount: number; // collected + owed
  collected: number; // dollars from Invoiced or Paid sessions
  owed: number; // dollars from billable sessions not yet invoiced
  isCurrent: boolean;
};

export function weeklyEarnings(payload: Payload, today: string, weeks = 6): WeekEarning[] {
  const currentWeek = startOfWeekISO(today);
  const byWeek = new Map<string, WeekEarning>();

  const ensure = (weekStart: string): WeekEarning => {
    let w = byWeek.get(weekStart);
    if (!w) {
      w = {
        weekStart,
        hours: 0,
        amount: 0,
        collected: 0,
        owed: 0,
        isCurrent: weekStart === currentWeek,
      };
      byWeek.set(weekStart, w);
    }
    return w;
  };

  // Always surface the current week, even at zero, so the instrument renders at rest.
  ensure(currentWeek);

  for (const s of payload.hours) {
    if (!isLive(s)) continue; // drops superseded and non-billable
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) continue;
    const w = ensure(startOfWeekISO(s.date));
    const dollars = s.hours * s.rate;
    w.hours += s.hours;
    w.amount += dollars;
    if (BILLED_STATUSES.has(s.status)) w.collected += dollars;
    else w.owed += dollars;
  }

  return [...byWeek.values()]
    .sort((a, b) => (a.weekStart < b.weekStart ? 1 : a.weekStart > b.weekStart ? -1 : 0))
    .slice(0, weeks);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test lib/hours.test.ts`
Expected: all `weeklyEarnings` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/hours.ts lib/hours.test.ts
git commit -m "Add weeklyEarnings derivation for the earnings-by-week instrument"
```

---

## Task 4: EarningsByWeek component

Pure presentational component that renders the horizontal week bars. Green fill for collected, hot for owed, current week outlined amber. Bars ease to width with a bounded transition already covered by the global reduced-motion rule.

**Files:**
- Create: `app/cockpit/EarningsByWeek.tsx`
- Create: `app/cockpit/EarningsByWeek.test.tsx`
- Modify: `app/globals.css` (append `.earn` block; see Step 3)

**Interfaces:**
- Consumes: `WeekEarning` from `lib/hours`; `money`, `shortDate` from `lib/invoice`.
- Produces: default-exported `EarningsByWeek` with props `{ weeks: WeekEarning[] }`.

- [ ] **Step 1: Write failing render test**

Create `app/cockpit/EarningsByWeek.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import EarningsByWeek from "./EarningsByWeek";
import type { WeekEarning } from "@/lib/hours";

const weeks: WeekEarning[] = [
  { weekStart: "2026-07-13", hours: 21.59, amount: 647.7, collected: 0, owed: 647.7, isCurrent: true },
  { weekStart: "2026-07-06", hours: 16.45, amount: 493.5, collected: 493.5, owed: 0, isCurrent: false },
];

describe("EarningsByWeek", () => {
  it("renders a row per week with the dollar figure", () => {
    const html = renderToStaticMarkup(<EarningsByWeek weeks={weeks} />);
    expect(html).toContain("$647.70");
    expect(html).toContain("$493.50");
  });

  it("marks the current week", () => {
    const html = renderToStaticMarkup(<EarningsByWeek weeks={weeks} />);
    expect(html).toContain("earn-row current");
  });

  it("renders an at-rest message when every week is empty", () => {
    const empty: WeekEarning[] = [
      { weekStart: "2026-07-13", hours: 0, amount: 0, collected: 0, owed: 0, isCurrent: true },
    ];
    const html = renderToStaticMarkup(<EarningsByWeek weeks={empty} />);
    expect(html).toContain("No earnings logged yet");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test app/cockpit/EarningsByWeek.test.tsx`
Expected: FAIL, cannot resolve `./EarningsByWeek`.

- [ ] **Step 3: Implement the component**

Create `app/cockpit/EarningsByWeek.tsx`:

```tsx
// Earnings by week: one horizontal bar per week, length mapped to dollars against the biggest
// week in the set. Collected fills green (--ok), owed fills hot (--hot), so a paid week reads
// all green and money still out reads red. Current week is outlined amber. Pure CSS, no render
// loop. Tokens only, no hardcoded hex, per the two-systems rule. docs/10-visual-direction.md.

import type { WeekEarning } from "@/lib/hours";
import { money, shortDate } from "@/lib/invoice";

export default function EarningsByWeek({ weeks }: { weeks: WeekEarning[] }) {
  const max = Math.max(1, ...weeks.map((w) => w.amount));
  const anyMoney = weeks.some((w) => w.amount > 0);

  return (
    <div className="earn">
      {!anyMoney ? (
        <p className="earn-empty">No earnings logged yet this period.</p>
      ) : (
        weeks.map((w) => {
          const collectedPct = (w.collected / max) * 100;
          const owedPct = (w.owed / max) * 100;
          return (
            <div className={`earn-row${w.isCurrent ? " current" : ""}`} key={w.weekStart}>
              <span className="earn-wk mono">{shortDate(w.weekStart)}</span>
              <span className="earn-track" aria-hidden="true">
                <span className="earn-fill ok" style={{ width: `${collectedPct}%` }} />
                <span className="earn-fill owed" style={{ width: `${owedPct}%` }} />
              </span>
              <span className="earn-hrs mono">{w.hours.toFixed(1)}h</span>
              <span className={`earn-amt mono${w.owed > 0 ? " owed" : " ok"}`}>
                {money(w.amount)}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
```

- [ ] **Step 4: Append the CSS**

Add to the end of `app/globals.css`, before the final `@media (prefers-reduced-motion)` block (so the global reduced-motion reset still wins):

```css
/* ---------- earnings by week ----------
   Horizontal week bars that rhyme with the day trace. Collected is --ok, owed is --hot,
   the two only console places --hot is spent besides the runner and the now line, and it
   is spent here for the same reason: money not yet collected. docs/10. */
.earn {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.earn-row {
  display: grid;
  grid-template-columns: 54px 1fr 46px 78px;
  gap: 10px;
  align-items: center;
}
.earn-wk {
  font-size: 10px;
  color: var(--dim);
  letter-spacing: 0.04em;
}
.earn-track {
  position: relative;
  display: flex;
  height: 16px;
  background: color-mix(in srgb, var(--bg) 70%, #000);
  border: 1px solid var(--line);
  border-radius: 3px;
  overflow: hidden;
}
.earn-row.current .earn-track {
  border-color: var(--amber);
}
.earn-fill {
  height: 100%;
  transition: width 500ms cubic-bezier(0.16, 1, 0.3, 1);
}
.earn-fill.ok {
  background: var(--ok);
}
.earn-fill.owed {
  background: var(--hot);
  opacity: 0.9;
}
.earn-hrs {
  font-size: 11px;
  text-align: right;
  color: var(--dim);
}
.earn-amt {
  font-size: 12px;
  text-align: right;
}
.earn-amt.ok {
  color: var(--ok);
}
.earn-amt.owed {
  color: var(--hot);
}
.earn-empty {
  color: var(--dim);
  font-size: 12px;
  padding: 6px 2px;
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test app/cockpit/EarningsByWeek.test.tsx && npm run typecheck`
Expected: 3 tests PASS, typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add app/cockpit/EarningsByWeek.tsx app/cockpit/EarningsByWeek.test.tsx app/globals.css
git commit -m "Add the EarningsByWeek instrument and its styles"
```

---

## Task 5: Extract the instrument cluster from the dashboard

Lift the readout gauges, the day trace, and the hours dial out of `app/dashboard/Dashboard.tsx` into a reusable component the cockpit will place on top. `StatGauge` (defined inside `Dashboard.tsx`, lines 40-75) moves with it.

**Files:**
- Create: `app/cockpit/InstrumentCluster.tsx`
- Create: `app/cockpit/InstrumentCluster.test.tsx`

**Interfaces:**
- Consumes: `Payload` from `lib/notion`; `useCountUp` from `app/useCountUp`; `HoursGauge` from `app/dashboard/HoursGauge`; `DayTrace` from `app/dashboard/DayTrace`; `buildDayTraces`, `dayReadout`, `weekReadout`, `monthReadout`, `unbilled`, `type Readout` from `lib/hours`; `money` from `lib/invoice`. (Earnings-by-week is rendered separately by the cockpit in Task 7, not here.)
- Produces: default-exported `InstrumentCluster` with props `{ data: Payload | null; today: string | null }`. It renders the four gauges and the full-width day trace. It does NOT render the hours dial or the manifest (those move to the cockpit's lower area in Task 7).

- [ ] **Step 1: Write failing render test**

Create `app/cockpit/InstrumentCluster.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import InstrumentCluster from "./InstrumentCluster";

describe("InstrumentCluster", () => {
  it("renders four readout labels at rest when data is null", () => {
    const html = renderToStaticMarkup(<InstrumentCluster data={null} today={null} />);
    expect(html).toContain("Today");
    expect(html).toContain("This week");
    expect(html).toContain("This month");
    expect(html).toContain("Unbilled");
  });
});
```

Note: `useCountUp` must be safe to call during server render. It returns the target value on first render (no animation frame on the server), so `renderToStaticMarkup` produces the resting figures. Confirm this while implementing; if `useCountUp` throws on the server, wrap its use so the cluster renders the raw value when `typeof window === "undefined"`.

- [ ] **Step 2: Run to verify it fails**

Run: `npm test app/cockpit/InstrumentCluster.test.tsx`
Expected: FAIL, cannot resolve `./InstrumentCluster`.

- [ ] **Step 3: Create the component**

Move `StatGauge` (Dashboard.tsx lines 40-75), the `REST` constant (line 38), and `MONTHLY_TARGET_HOURS` (line 36) into this file. Build the cluster from the gauges section (Dashboard.tsx lines 163-220). Create `app/cockpit/InstrumentCluster.tsx`:

```tsx
"use client";

// The instrument cluster: the four readouts and the full-width day trace, lifted from the
// dashboard so the cockpit can sit them across the top of one screen. Pure derivation from the
// single Payload, rendered at rest until "today" resolves after mount, which docs/10 blesses:
// an instrument at rest still looks like an instrument.

import type { Payload } from "@/lib/notion";
import { useCountUp } from "../useCountUp";
import { HoursGauge } from "../dashboard/HoursGauge";
import { DayTrace } from "../dashboard/DayTrace";
import {
  buildDayTraces,
  dayReadout,
  weekReadout,
  monthReadout,
  unbilled,
  type Readout,
} from "@/lib/hours";
import { money } from "@/lib/invoice";

export const MONTHLY_TARGET_HOURS = 60;
const REST: Readout = { hours: 0, excluded: 0, sessions: 0 };

function StatGauge({
  label, value, unit, sub, fill, tone,
}: {
  label: string; value: number; unit: "h" | "$"; sub: string; fill: number; tone?: "pri" | "cash";
}) {
  const shown = useCountUp(value);
  return (
    <div className={`g${tone ? " " + tone : ""}`}>
      <span className="lbl">{label}</span>
      <div className="v mono">
        {unit === "$" ? money(shown) : (<>{shown.toFixed(2)}<i>h</i></>)}
      </div>
      <div className="u">{sub}</div>
      <div className="track" aria-hidden="true">
        <div className="fill" style={{ width: `${Math.max(0, Math.min(100, fill))}%` }} />
      </div>
    </div>
  );
}

export default function InstrumentCluster({
  data, today,
}: {
  data: Payload | null; today: string | null;
}) {
  const sessions = data?.hours ?? [];
  const day = today ? dayReadout(sessions, today) : REST;
  const week = today ? weekReadout(sessions, today) : REST;
  const month = today ? monthReadout(sessions, today) : REST;
  const owed = data && today ? unbilled(data, today) : null;
  const traces = buildDayTraces(sessions);
  const traceSum = traces.reduce((s, d) => s + d.hours, 0);
  const overlapDays = traces.filter((d) => d.hasOverlap).length;

  return (
    <>
      <section className="gauges" aria-label="Readout">
        <StatGauge label="Today" value={day.hours} unit="h"
          sub={today ? `${day.sessions} session${day.sessions === 1 ? "" : "s"}${day.excluded ? ` · ${day.excluded.toFixed(2)}h off` : ""}` : "standby"}
          fill={(day.hours / 8) * 100} tone="pri" />
        <StatGauge label="This week" value={week.hours} unit="h"
          sub={today ? "since Monday" : "standby"} fill={(week.hours / 40) * 100} />
        <StatGauge label="This month" value={month.hours} unit="h"
          sub={today ? (month.excluded ? `billable · ${month.excluded.toFixed(2)}h excluded` : "billable") : "standby"}
          fill={(month.hours / MONTHLY_TARGET_HOURS) * 100} />
        <StatGauge label="Unbilled" value={owed?.amount ?? 0} unit="$"
          sub={owed ? `${owed.sessions} sessions · since ${owed.since}` : "standby"}
          fill={((owed?.hours ?? 0) / MONTHLY_TARGET_HOURS) * 100} tone="cash" />
      </section>

      <section className="mod" aria-label="Day trace">
        <div className="mod-h">
          <span className="eyebrow">Day trace · 00:00 to 24:00 local</span>
          <span className="eyebrow dim">
            {traces.length} day{traces.length === 1 ? "" : "s"} · {traceSum.toFixed(2)}h logged
            {overlapDays > 0 && ` · ${overlapDays} overlap`}
          </span>
        </div>
        <div className="mod-b">
          <DayTrace traces={traces} today={today ?? ""} />
        </div>
      </section>
    </>
  );
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test app/cockpit/InstrumentCluster.test.tsx && npm run typecheck`
Expected: test PASS, typecheck clean. If `useCountUp` errored on the server, apply the guard noted in Step 1 and re-run.

- [ ] **Step 5: Commit**

```bash
git add app/cockpit/InstrumentCluster.tsx app/cockpit/InstrumentCluster.test.tsx
git commit -m "Extract the instrument cluster into a reusable cockpit component"
```

---

## Task 6: Decompose the invoice builder into components

Split the paper, the controls, the session ledger, and the flags out of `app/page.tsx` into presentational components, and rewire `app/page.tsx` to use them. After this task `/` still renders the exact same invoice builder; only the file structure changes. This keeps the print CSS untouched because the same class names render.

**Files:**
- Create: `app/cockpit/InvoicePaper.tsx`
- Create: `app/cockpit/InvoiceControls.tsx`
- Create: `app/cockpit/SessionManifest.tsx`
- Create: `app/cockpit/DataFlags.tsx`
- Modify: `app/page.tsx` (import and use the four components)

**Interfaces:**
- `SessionManifest` props: `{ days: string[]; visible: Session[]; picked: Set<string>; onToggle: (url: string) => void }`. Renders the `#ledger` day groups and `.sess` rows. Consumes `money` from `lib/invoice`, `StatusLed` from `app/StatusLed`, `byDayDesc` from `lib/selection`.
- `DataFlags` props: `{ flags: string[] }`. Renders the `.flags` block.
- `InvoiceControls` props: `{ invno, invdate, terms, duedate, mode, round, showall, showsid, onInvno, onInvdate, onTerms, onDuedate, onMode, onRound, onShowall, onShowsid }` where the setters are `(value) => void` with the value types matching the state (`string` except `round: number`, `mode: Mode`, and the two toggles `boolean`). Renders the `.opt` fieldset and the two `.toggle`s. Consumes `type Mode` from `lib/selection`.
- `InvoicePaper` props: `{ data: Payload | null; err: { error: string; hint?: string } | null; lines: Line[]; entries: Entry[]; invno: string; invdate: string; duedate: string; terms: string; totalHours: number; totalAmt: number; rates: number[]; showsid: boolean }` where `Line = Session & { billed: number; amount: number }` and `Entry = { h: string; stamp: string; body: string; key: string }`. Renders the whole `.paper`. Consumes `money`, `fmtDate`, `shortDate` from `lib/invoice`.

- [ ] **Step 1: Create `app/cockpit/SessionManifest.tsx`**

Lift the `#ledger` block from `app/page.tsx` (lines 261-316). Create:

```tsx
import type { Session } from "@/lib/notion";
import { money } from "@/lib/invoice";
import { byDayDesc, isTerminal } from "@/lib/selection";
import { StatusLed } from "../StatusLed";

export default function SessionManifest({
  days, visible, picked, onToggle,
}: {
  days: string[]; visible: Session[]; picked: Set<string>; onToggle: (url: string) => void;
}) {
  return (
    <div id="ledger">
      {!visible.length ? (
        <p style={{ color: "var(--dim)", fontSize: 12, padding: "8px 2px" }}>
          No sessions in this range.
        </p>
      ) : (
        days.map((day) => {
          const dayRows = [...visible].sort(byDayDesc).filter((r) => r.date === day);
          const dayH = dayRows.reduce((s, r) => s + (picked.has(r.url) ? r.hours : 0), 0);
          return (
            <div className="day" key={day}>
              <div className="day-head">
                <span className="d">{day}</span>
                <span className="h">{dayH ? dayH.toFixed(2) + " h" : "—"}</span>
              </div>
              {dayRows.map((r) => (
                <label
                  className={`sess ${picked.has(r.url) ? "on" : ""} ${isTerminal(r.status) ? "locked" : ""}`}
                  key={r.url}
                >
                  <input type="checkbox" checked={picked.has(r.url)} onChange={() => onToggle(r.url)} />
                  <span>
                    <span className="sid">{r.sid}</span>
                    <span className="meta">
                      <span style={{ flexBasis: "100%" }}>
                        {r.start} – {r.end}{r.location ? " · " + r.location : ""}
                      </span>
                      <StatusLed status={r.status} />
                      <span className="statuslabel">{r.status}</span>
                      {!r.billable && <span className="nobill">· non-billable</span>}
                    </span>
                  </span>
                  <span className="amt">
                    <b>{r.hours.toFixed(2)} h</b>
                    <span>{money(r.hours * r.rate)}</span>
                  </span>
                </label>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}
```

Note: the `locked` class (from `isTerminal(r.status)`) is preserved above so Invoiced and Paid rows stay greyed exactly as they do today. The only simplification from the original is the empty-state string: the original distinguished "Loading sessions…" (data null) from "No sessions between X and Y." In the cockpit the paper already shows "Reading Notion…" during load, so a single "No sessions in this range." message here is enough.

- [ ] **Step 2: Create `app/cockpit/DataFlags.tsx`**

Lift lines 426-438. Create:

```tsx
export default function DataFlags({ flags }: { flags: string[] }) {
  return (
    <div className={`flags${flags.length ? "" : " clean"}`}>
      {flags.length ? (
        flags.map((f, i) => (
          <p key={i}><span dangerouslySetInnerHTML={{ __html: f }} /></p>
        ))
      ) : (
        <p><span>Nothing to flag. Selection is clean.</span></p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `app/cockpit/InvoiceControls.tsx`**

Lift the `.opt` fieldset and toggles (lines 336-423). Create:

```tsx
import type { Mode } from "@/lib/selection";

export default function InvoiceControls(props: {
  invno: string; invdate: string; terms: string; duedate: string;
  mode: Mode; round: number; showall: boolean; showsid: boolean;
  onInvno: (v: string) => void; onInvdate: (v: string) => void;
  onTerms: (v: string) => void; onDuedate: (v: string) => void;
  onMode: (v: Mode) => void; onRound: (v: number) => void;
  onShowall: (v: boolean) => void; onShowsid: (v: boolean) => void;
}) {
  const {
    invno, invdate, terms, duedate, mode, round, showall, showsid,
    onInvno, onInvdate, onTerms, onDuedate, onMode, onRound, onShowall, onShowsid,
  } = props;
  return (
    <>
      <div className="opt">
        <div className="field">
          <label htmlFor="invno">Number</label>
          <input type="text" id="invno" value={invno} onChange={(e) => onInvno(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="invdate">Invoice date</label>
          <input type="date" id="invdate" value={invdate} onChange={(e) => onInvdate(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="terms">Terms</label>
          <select id="terms" value={terms} onChange={(e) => onTerms(e.target.value)}>
            <option>Net 15</option>
            <option>Net 30</option>
            <option>Due on receipt</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="duedate">Due</label>
          <input type="date" id="duedate" value={duedate} onChange={(e) => onDuedate(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="detail">Work detail</label>
        <select id="detail" value={mode} onChange={(e) => onMode(e.target.value as Mode)}>
          <option value="invoice">Invoice descriptions (client-facing)</option>
          <option value="summary">Summaries only (short)</option>
          <option value="notes">Session notes (verbatim)</option>
          <option value="none">Line items only</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="round">Hour rounding</label>
        <select id="round" value={String(round)} onChange={(e) => onRound(parseFloat(e.target.value))}>
          <option value="0">Exact (2 decimals)</option>
          <option value="0.25">Nearest quarter hour</option>
          <option value="0.1">Nearest tenth</option>
        </select>
      </div>
      <label className="toggle">
        <input type="checkbox" checked={showall} onChange={(e) => onShowall(e.target.checked)} />{" "}
        Show non-billable and superseded
      </label>
      <label className="toggle">
        <input type="checkbox" checked={showsid} onChange={(e) => onShowsid(e.target.checked)} />{" "}
        Print session IDs on line items
      </label>
    </>
  );
}
```

Note: the invoice-date change in the original also re-syncs the due date (page.tsx line 352-353), and the terms change re-syncs due (line 363-364). Keep that behavior in `app/page.tsx`'s handlers passed as `onInvdate` and `onTerms` (see Step 5), not inside this presentational component.

- [ ] **Step 4: Create `app/cockpit/InvoicePaper.tsx`**

Lift the entire `.paper` block (lines 442-587) into a component. Define `Line` and `Entry` types at the top. Create:

```tsx
import type { Payload, Session } from "@/lib/notion";
import { money, fmtDate, shortDate } from "@/lib/invoice";

export type Line = Session & { billed: number; amount: number };
export type Entry = { h: string; stamp: string; body: string; key: string };

export default function InvoicePaper(props: {
  data: Payload | null;
  err: { error: string; hint?: string } | null;
  lines: Line[];
  entries: Entry[];
  invno: string;
  invdate: string;
  duedate: string;
  terms: string;
  totalHours: number;
  totalAmt: number;
  rates: number[];
  showsid: boolean;
}) {
  const { data, err, lines, entries, invno, invdate, duedate, terms, totalHours, totalAmt, rates, showsid } = props;
  return (
    <div className="paper">
      {err && !data ? (
        <div className="loadstate">
          <b>Notion read failed.</b>
          {err.error}
          {err.hint && <div className="hint">{err.hint}</div>}
        </div>
      ) : !data ? (
        <div className="loadstate">Reading Notion…</div>
      ) : !lines.length ? (
        <div className="empty">Pick sessions on the left and the invoice builds itself here.</div>
      ) : (
        <>
          <div className="inv-head">
            <div>
              <div className="lockup">
                <img className="letterhead" src="/brand/bbb-logo-horizontal-black.png"
                  width={3000} height={1000} loading="eager" decoding="sync"
                  alt="Battle Bound Branding LLC" />
                <h1>Invoice</h1>
              </div>
              <div className="sub" contentEditable suppressContentEditableWarning>
                Independent contractor · digital systems &amp; automation
              </div>
            </div>
            <div className="inv-no">
              <div className="n">{invno}</div>
              <div className="dates">
                Issued {fmtDate(invdate)}<br />
                Due {fmtDate(duedate)} · {terms}
              </div>
            </div>
          </div>

          <div className="parties">
            <div>
              <div className="k">From</div>
              <div className="v" contentEditable suppressContentEditableWarning>{data.from}</div>
            </div>
            <div>
              <div className="k">Bill to</div>
              <div className="v" contentEditable suppressContentEditableWarning>{data.client.billTo}</div>
            </div>
          </div>

          <div className="period">
            <span>Service period</span>
            <b>{fmtDate(lines[0].date)} – {fmtDate(lines[lines.length - 1].date)}</b>
          </div>

          <table className="items">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th style={{ textAlign: "right" }}>Hours</th>
                <th style={{ textAlign: "right" }}>Rate</th>
                <th style={{ textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.url}>
                  <td className="date-c">{shortDate(l.date)}</td>
                  <td className="desc">
                    <b>{l.start} – {l.end}{l.location && l.location !== "Not specified" ? " · " + l.location : ""}</b>
                    {showsid && <small>{l.sid}</small>}
                  </td>
                  <td className="r">{l.billed.toFixed(2)}</td>
                  <td className="r">{money(l.rate)}</td>
                  <td className="r">{money(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="totals">
            <table>
              <tbody>
                <tr><td>Billable hours</td><td>{totalHours.toFixed(2)}</td></tr>
                <tr><td>Rate</td><td>{rates.length === 1 ? money(rates[0]) + " / hr" : "mixed"}</td></tr>
                <tr className="grand"><td>Total due</td><td>{money(totalAmt)}</td></tr>
              </tbody>
            </table>
          </div>

          {entries.length > 0 && (
            <div className="detail">
              <h3>Work performed</h3>
              {entries.map((e, i) => (
                <div className="entry" key={i}>
                  <h4>{e.h}</h4>
                  <div className="stamp">{e.stamp}</div>
                  <p>{e.body}</p>
                </div>
              ))}
            </div>
          )}

          <div className="foot">
            <span>{data.client.name}</span>
            <span>{invno} · {lines.length} session{lines.length > 1 ? "s" : ""} · {totalHours.toFixed(2)} h</span>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Rewire `app/page.tsx` to use the components**

In `app/page.tsx`: import the four components and the `Line`/`Entry` types from `InvoicePaper`. Remove the local `Entry` type (line 32) and use the imported one. Replace the JSX at lines 261-316 with `<SessionManifest days={days} visible={visible} picked={picked} onToggle={toggle} />`. Replace lines 336-423 with `<InvoiceControls .../>` wiring each setter; for `onInvdate` pass `(v) => { setInvdate(v); syncDue(terms, v); }` and for `onTerms` pass `(v) => { setTerms(v); syncDue(v, invdate); }`. Replace lines 426-438 with `<DataFlags flags={flags} />`. Replace the `<main className="paperstage"><div className="paper">...</div></main>` body (lines 441-588) with `<main className="paperstage"><InvoicePaper data={data} err={err} lines={lines} entries={entries} invno={invno} invdate={invdate} duedate={duedate} terms={terms} totalHours={totalHours} totalAmt={totalAmt} rates={rates} showsid={showsid} /></main>`.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 7: Verify the invoice is unchanged in the browser**

Run the dev server (see Task 7 Step 5 for the preview commands; use `preview_start` with the `afp-invoice-dev` config). Load `/`. Confirm the invoice paper renders the same line items and totals as before, the range presets work, and Cmd+P to PDF still produces a clean letter-size document with the console stripped. This is a refactor, so the output must be identical to before Task 6.

- [ ] **Step 8: Commit**

```bash
git add app/cockpit/InvoicePaper.tsx app/cockpit/InvoiceControls.tsx app/cockpit/SessionManifest.tsx app/cockpit/DataFlags.tsx app/page.tsx
git commit -m "Decompose the invoice builder into cockpit components"
```

---

## Task 7: Assemble the unified cockpit at /

Rebuild `app/page.tsx` as the cockpit: instrument cluster on top, then the split (left column: session manifest, earnings, running total, invoice controls, data flags; right column: the live paper). The top bar keeps the range controls and Save PDF. Add the cockpit layout CSS and extend the print rule to hide the cluster.

**Files:**
- Modify: `app/page.tsx` (compose the cockpit; keep all existing state and memos)
- Modify: `app/globals.css` (add `.cockpit` layout; extend `@media print`)

**Interfaces:**
- Consumes everything from Tasks 4, 5, 6, plus `weeklyEarnings` from `lib/hours`.
- Produces: the cockpit at `/`.

- [ ] **Step 1: Add cockpit layout CSS**

Append to `app/globals.css` (before the reduced-motion block):

```css
/* ---------- cockpit ----------
   The unified screen: instrument cluster across the top, then a split of the session and
   earnings console on the left and the live paper on the right. Reuses the console tokens.
   Layout A from the design spec. */
.cockpit-top {
  padding: 16px 16px 2px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cockpit-split {
  display: grid;
  grid-template-columns: 400px 1fr;
  align-items: start;
}
.cockpit-console {
  border-right: 1px solid var(--line);
  height: calc(100vh - 59px);
  overflow-y: auto;
  padding: 18px 16px 60px;
}
.cockpit-console h2 {
  font-size: 10px;
  letter-spacing: 0.16em;
  margin-bottom: 12px;
}
.cockpit-console h2 + h2,
.cockpit-console .earn + h2,
.cockpit-console .runner + h2 {
  margin-top: 26px;
}
@media (max-width: 1100px) {
  .cockpit-split {
    grid-template-columns: 1fr;
  }
  .cockpit-console {
    height: auto;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
}
```

- [ ] **Step 2: Extend the print rule to hide the cluster**

In the `@media print` block of `app/globals.css`, add `.cockpit-top` and `.cockpit-console` to the `display: none !important;` group that currently lists `.topbar, .rail, .printwipe, .deck`. The result:

```css
  .topbar,
  .rail,
  .printwipe,
  .deck,
  .cockpit-top,
  .cockpit-console {
    display: none !important;
  }
```

Also add `.cockpit-split { display: block; }` next to the existing `.stage { display: block; }` rule so the paper column is not left in a one-column grid track.

- [ ] **Step 3: Recompose `app/page.tsx`**

Keep every hook, state, memo, and helper call exactly as they are (the boot effect, `setRange`, `visible`, `selected`, `lines`, `entries`, `flags`, the count-ups, `savePdf`, `days`). Change only the returned JSX. Add `const weeks = useMemo(() => (data && today2 ? weeklyEarnings(data, today2, 6) : []), [data, today2])` where `today2` is a client-resolved today value. Since the invoice builder does not currently hold a `today` state, add one the same way the dashboard does:

```tsx
const [today2, setToday2] = useState<string | null>(null);
useEffect(() => { setToday2(todayISO()); }, []);
```

Import `InstrumentCluster` from `./cockpit/InstrumentCluster`, `EarningsByWeek` from `./cockpit/EarningsByWeek`, `SessionManifest`, `InvoiceControls`, `DataFlags`, `InvoicePaper` from their `./cockpit/` paths, and `weeklyEarnings` from `@/lib/hours`. Replace the returned JSX with:

```tsx
  return (
    <div className="station">
      {wiping && <div className="printwipe run" aria-hidden="true" />}
      <div className="topbar">
        <div className="brand">
          <b>AFP Cockpit</b>
          <span>{data?.client.name ?? "Anytime Fuel Pros"}</span>
        </div>
        <div className="rangebox">
          <label htmlFor="from">From</label>
          <input type="date" id="from" value={from} onChange={(e) => setRange(e.target.value, to)} />
          <label htmlFor="to">To</label>
          <input type="date" id="to" value={to} onChange={(e) => setRange(from, e.target.value)} />
          <div className="chips">
            <button className="chip" onClick={() => preset("unbilled")}>Unbilled</button>
            <button className="chip" onClick={() => preset("week")}>This week</button>
            <button className="chip" onClick={() => preset("month")}>This month</button>
            <button className="chip" onClick={() => preset("all")}>All</button>
          </div>
        </div>
        <SyncStatus lastSynced={lastSynced} refreshing={refreshing} error={Boolean(err)} onRefresh={refresh} />
        <button className="print-btn" onClick={savePdf}>Save PDF</button>
      </div>

      <div className="cockpit-top">
        <InstrumentCluster data={data} today={today2} />
      </div>

      <div className="cockpit-split">
        <aside className="cockpit-console">
          <h2>Sessions in range</h2>
          <SessionManifest days={days} visible={visible} picked={picked} onToggle={toggle} />

          <div className="runner">
            <div className="row"><span>Selected</span><b className="mono">{selected.length} session{selected.length === 1 ? "" : "s"}</b></div>
            <div className="row"><span>Hours</span><b className="mono">{shownHours.toFixed(2)}</b></div>
            <div className="row total"><span>Amount</span><b className="mono">{money(shownAmt)}</b></div>
          </div>

          <h2>Earnings by week</h2>
          <EarningsByWeek weeks={weeks} />

          <h2>Invoice</h2>
          <InvoiceControls
            invno={invno} invdate={invdate} terms={terms} duedate={duedate}
            mode={mode} round={round} showall={showall} showsid={showsid}
            onInvno={setInvno}
            onInvdate={(v) => { setInvdate(v); syncDue(terms, v); }}
            onTerms={(v) => { setTerms(v); syncDue(v, invdate); }}
            onDuedate={setDuedate}
            onMode={setMode} onRound={setRound} onShowall={setShowall} onShowsid={setShowsid}
          />

          <h2>Data flags</h2>
          <DataFlags flags={flags} />
        </aside>

        <main className="paperstage">
          <InvoicePaper
            data={data} err={err} lines={lines} entries={entries}
            invno={invno} invdate={invdate} duedate={duedate} terms={terms}
            totalHours={totalHours} totalAmt={totalAmt} rates={rates} showsid={showsid}
          />
        </main>
      </div>
    </div>
  );
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 5: Verify in the browser**

Start the dev server through the preview tool (config name `afp-invoice-dev` from `.claude/launch.json`). Note: without a real `NOTION_TOKEN` in `.env.local`, the API route returns the shared-not-found error and the paper shows the "Notion read failed" state while the instruments render at rest. That still verifies layout, the cluster, the earnings bars (with the error state the manifest is empty; to see populated instruments either supply a token or temporarily seed as the reviewer prefers). With a token present: confirm the instrument cluster sits on top, the split shows manifest plus earnings on the left and the live paper on the right, selecting a session moves the running total, and the earnings bars show green and red by week. Screenshot for the record.

- [ ] **Step 6: Verify print still works**

Cmd+P to PDF. Expected: the cluster and the left console vanish, only the paper prints, letter size, no work entry split across a page break.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx app/globals.css
git commit -m "Assemble the unified Station cockpit at the root route"
```

---

## Task 8: Retire the /dashboard route

The cockpit now carries the dashboard's instruments, so `/dashboard` becomes a redirect and the two-way nav chips go away.

**Files:**
- Modify: `app/dashboard/page.tsx` (replace with a redirect to `/`)
- Delete: `app/dashboard/Dashboard.tsx` (its pieces now live in the cockpit and InstrumentCluster). Keep `app/dashboard/DayTrace.tsx` and `app/dashboard/HoursGauge.tsx`; they are imported by the cockpit.

- [ ] **Step 1: Replace the dashboard page with a redirect**

Replace the contents of `app/dashboard/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

// The dashboard merged into the cockpit at /. Anything still pointing here lands on the
// cockpit rather than a dead route.
export default function DashboardRedirect() {
  redirect("/");
}
```

- [ ] **Step 2: Delete the old dashboard shell**

Run: `git rm app/dashboard/Dashboard.tsx`
Expected: file removed. `DayTrace.tsx` and `HoursGauge.tsx` remain.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean. If typecheck flags an unused import of `Dashboard` anywhere, remove it.

- [ ] **Step 4: Verify the redirect**

With the dev server running, navigate to `/dashboard`. Expected: it lands on `/` (the cockpit).

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "Redirect the retired dashboard route to the cockpit"
```

---

## Task 9: Responsive and phone pass

Under 1100px the split already stacks (Task 7 CSS). This task defines the phone experience: instruments and console first, the paper collapsed to a preview with Save PDF, so a full invoice build stays a desktop act while checking hours and what is owed works on a phone.

**Files:**
- Modify: `app/globals.css` (phone rules for `.cockpit-split` and `.paperstage`)

- [ ] **Step 1: Add phone rules**

Append to `app/globals.css` (before the reduced-motion block):

```css
/* Phone: the console stacks above a scaled-down paper preview. Building a full invoice is a
   desktop act; on a phone you check hours, earnings, and what is owed, and can still Save PDF.
   The paper keeps its true 8.5in width for print correctness and is visually scaled only on
   screen at this width. */
@media (max-width: 720px) {
  .cockpit-console {
    padding: 14px 12px 30px;
  }
  .paperstage {
    padding: 16px;
    height: auto;
    overflow-x: auto;
  }
  .paper {
    transform: scale(0.62);
    transform-origin: top center;
    margin-bottom: -22%;
  }
}
@media print {
  .paper {
    transform: none;
    margin-bottom: 0;
  }
}
```

- [ ] **Step 2: Verify at phone width**

In the preview, set the viewport to mobile (375 wide). Expected: the instrument cluster stacks (gauges go to one column via the existing `@media (max-width: 620px)` rule), earnings and manifest are readable, and the paper appears as a scaled preview. The Save PDF button in the top bar still triggers print, and printed output is full size (the print override resets the transform).

- [ ] **Step 3: Reduced-motion check**

In the preview, emulate `prefers-reduced-motion: reduce`. Expected: the count-ups, the earnings bar transitions, the segment grow-in, and the print wipe are all inert (the global rule at the bottom of `globals.css` forces `transition: none` and `animation: none`).

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "Define the phone layout for the cockpit"
```

---

## Task 10: Deploy prep and final verification

Get the cockpit ready to host on Vercel behind the existing auth. Several steps need the user's Notion token and Vercel account, so this task is a checklist plus the parts that can be automated. It ends with a documented go or no-go.

**Files:**
- Read and confirm: `.env.example`, `middleware.ts`, `vercel.json`, `next.config.mjs`, `docs/08-deploy.md`
- Modify (only if a gap is found): `.env.example` or `docs/08-deploy.md`

- [ ] **Step 1: Confirm the env contract**

Read `.env.example` and `lib/notion.ts` `requireEnv` calls. Confirm the required names are documented: `NOTION_TOKEN`, `APP_SECRET`, `NOTION_DS_HOURS`, `NOTION_DS_WORK`, `NOTION_DS_INVOICES`, `NOTION_DS_CLIENTS`, and optionally `NOTION_CLIENT_PAGE`. If any required name is missing from `.env.example`, add it with a comment. Do not put real values anywhere.

- [ ] **Step 2: Full build and typecheck**

Run: `npm run typecheck && npm run build`
Expected: both succeed. Fix any type or build error before proceeding.

- [ ] **Step 3: Full test run**

Run: `npm test`
Expected: all suites pass (selection, hours including weeklyEarnings, EarningsByWeek, InstrumentCluster).

- [ ] **Step 4: Live Notion join check (needs a token)**

This step requires a real `.env.local`. It is performed by the user or by the reviewer with credentials, not automated here. With a valid token: start the dev server, open `/`, and confirm the instruments and the invoice populate. Per Phase 1 discipline, log the raw payload once (`console.log` in the API route, removed after) and eyeball that hours join to work done. Expected: 11 hours rows, the invoice defaults to unbilled, the earnings bars show the Jul 06 week collected and the Jul 13 week owed.

- [ ] **Step 5: Print check on real data (needs a token)**

Cmd+P to PDF on a populated invoice. Expected: clean letter-size document, console stripped, no orphaned "Work performed" header, no entry split across a page break.

- [ ] **Step 6: Deploy (user action)**

Hand off the deploy to the user, since it needs their Vercel account and secrets. Provide these steps: create a Vercel project from the repo, set `NOTION_TOKEN`, `APP_SECRET`, and the four `NOTION_DS_*` env vars in Vercel, share the Notion integration with the Invoice Details page, deploy. Per `docs/08-deploy.md`. Do not deploy on the user's behalf and do not handle the secrets.

- [ ] **Step 7: Confirm the auth gate (after deploy)**

Once deployed, confirm the production URL returns 401 without credentials, per `docs/08-deploy.md` and the plan's done criterion. This is the definition of shipped.

- [ ] **Step 8: Final commit if any files changed**

```bash
git add -A
git commit -m "Document the deploy env contract for the cockpit"
```

---

## Self-review notes

- Spec coverage: layout A (Task 7), earnings-by-week logic and bars (Tasks 3, 4), instrument reuse (Task 5), invoice decomposition and print preservation (Tasks 6, 7), retire dashboard (Task 8), responsive phone (Task 9), deploy behind auth (Task 10). The two design systems stay separate because the paper keeps its own tokens and the print CSS is untouched.
- The `weeklyEarnings.owed` versus `unbilled()` distinction is called out in Task 3's code comment and tested, so the two are not conflated.
- Character: the channel-strip selection, count-ups, day-trace grow-in, and print wipe already exist in `globals.css` and are preserved; the earnings bars add one more bounded transition. No new render loop is introduced.
- Reduced motion is enforced globally and re-checked in Task 9.
