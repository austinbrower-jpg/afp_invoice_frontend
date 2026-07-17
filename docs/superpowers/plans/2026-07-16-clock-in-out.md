# Clock in / out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a clock in / clock out control to the AFP cockpit that writes one Draft Hours Worked row to Notion per clock-out.

**Architecture:** Pure time helpers in `lib/clock.ts`; a server insert in `lib/notion.ts` behind a new `POST /api/clock` route (auto-gated by the existing auth middleware); a `useClock` hook that persists the live clock in one localStorage key and refetches on save; a presentational view plus a container in the topbar. The write is insert only.

**Tech Stack:** Next.js App Router, TypeScript, `@notionhq/client` v5 (data-source API), vitest (node env, `renderToStaticMarkup` for components).

## Global Constraints

- `NOTION_TOKEN` is server-side only. Never `NEXT_PUBLIC_`, never in the client bundle. `lib/clock.ts` must not import `lib/notion.ts`.
- Insert only. One Draft row per clock-out. Never update or delete existing rows.
- The API stores raw floats. `Total Hours` is the unrounded float. Rounding stays client-side.
- Times come from the browser local clock (already Chicago time). The clock-in date is the session date.
- Only the in-progress clock is stored in the browser, under one key `afp.clock.v1`. No completed session or billing history touches localStorage.
- Notion write parent uses the data source id in `NOTION_DS_HOURS`; the client relation uses `NOTION_CLIENT_PAGE`.
- Hourly rate is the constant 30.
- No em dashes in comments, docs, or commit messages. No Tailwind. Interface copy is plain and active ("Clock in", "Clock out").

---

### Task 1: Time and id helpers in lib/clock.ts

**Files:**
- Create: `lib/clock.ts`
- Test: `lib/clock.test.ts`

**Interfaces:**
- Produces: `hhmm(h: number, m: number): string`, `to12h(h: number, m: number): string`, `sessionId(dateISO: string, sh: number, sm: number, eh: number, em: number): string`, `hoursBetween(startMs: number, endMs: number): number`, `elapsed(ms: number): string`

- [ ] **Step 1: Write the failing test**

```ts
// lib/clock.test.ts
import { describe, it, expect } from "vitest";
import { hhmm, to12h, sessionId, hoursBetween, elapsed } from "@/lib/clock";

describe("clock helpers", () => {
  it("hhmm zero-pads", () => {
    expect(hhmm(9, 3)).toBe("0903");
    expect(hhmm(14, 38)).toBe("1438");
  });
  it("to12h formats 12-hour with meridiem", () => {
    expect(to12h(9, 3)).toBe("9:03 AM");
    expect(to12h(14, 38)).toBe("2:38 PM");
    expect(to12h(0, 0)).toBe("12:00 AM");
    expect(to12h(12, 0)).toBe("12:00 PM");
  });
  it("sessionId matches the AFP-date-start-end format", () => {
    expect(sessionId("2026-07-16", 9, 3, 10, 27)).toBe("AFP-2026-07-16-0903-1027");
  });
  it("hoursBetween returns a raw float, correct across midnight", () => {
    expect(hoursBetween(0, 3_600_000)).toBeCloseTo(1, 10);
    const start = Date.UTC(2026, 6, 16, 23, 30);
    const end = Date.UTC(2026, 6, 17, 0, 30);
    expect(hoursBetween(start, end)).toBeCloseTo(1, 10);
  });
  it("elapsed formats H:MM:SS", () => {
    expect(elapsed(0)).toBe("0:00:00");
    expect(elapsed(5_025_000)).toBe("1:23:45");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/clock.test.ts`
Expected: FAIL, cannot resolve `@/lib/clock`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/clock.ts
// Pure, client-safe clock helpers. No import from lib/notion.ts: this module ships in the
// client bundle and must never pull in the Notion client or NOTION_TOKEN. Times are
// formatted the same way lib/notion.ts formats read times, so a clocked session reads like
// every hand-entered one ("9:03 AM").

const pad2 = (n: number): string => String(n).padStart(2, "0");

export function hhmm(h: number, m: number): string {
  return `${pad2(h)}${pad2(m)}`;
}

export function to12h(h: number, m: number): string {
  const mer = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${pad2(m)} ${mer}`;
}

export function sessionId(dateISO: string, sh: number, sm: number, eh: number, em: number): string {
  return `AFP-${dateISO}-${hhmm(sh, sm)}-${hhmm(eh, em)}`;
}

export function hoursBetween(startMs: number, endMs: number): number {
  return (endMs - startMs) / 3_600_000;
}

export function elapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${pad2(m)}:${pad2(s)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/clock.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/clock.ts lib/clock.test.ts
git commit -m "feat: pure clock time and session-id helpers"
```

---

### Task 2: ClockPayload type and validation in lib/clock.ts

**Files:**
- Modify: `lib/clock.ts`
- Test: `lib/clock.test.ts`

**Interfaces:**
- Produces: `type ClockPayload = { dateISO: string; sessionId: string; startDisplay: string; endDisplay: string; hours: number; location: string }`, `validateClockPayload(body: unknown): { ok: true; value: ClockPayload } | { ok: false; error: string }`
- Consumes: nothing from other tasks.

- [ ] **Step 1: Write the failing test**

```ts
// append to lib/clock.test.ts
import { validateClockPayload } from "@/lib/clock";

const good = {
  dateISO: "2026-07-16",
  sessionId: "AFP-2026-07-16-0903-1027",
  startDisplay: "9:03 AM",
  endDisplay: "10:27 AM",
  hours: 1.4,
  location: "Remote",
};

describe("validateClockPayload", () => {
  it("accepts a well-formed payload", () => {
    const r = validateClockPayload(good);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.location).toBe("Remote");
  });
  it("rejects a non-ISO date", () => {
    expect(validateClockPayload({ ...good, dateISO: "7/16/26" }).ok).toBe(false);
  });
  it("rejects zero or negative hours", () => {
    expect(validateClockPayload({ ...good, hours: 0 }).ok).toBe(false);
    expect(validateClockPayload({ ...good, hours: -2 }).ok).toBe(false);
  });
  it("rejects an absurd duration", () => {
    expect(validateClockPayload({ ...good, hours: 25 }).ok).toBe(false);
  });
  it("rejects missing fields", () => {
    expect(validateClockPayload({ ...good, location: "" }).ok).toBe(false);
    expect(validateClockPayload(null).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/clock.test.ts`
Expected: FAIL, `validateClockPayload` is not exported.

- [ ] **Step 3: Write minimal implementation**

```ts
// append to lib/clock.ts
export type ClockPayload = {
  dateISO: string;
  sessionId: string;
  startDisplay: string;
  endDisplay: string;
  hours: number;
  location: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_HOURS = 24;

export function validateClockPayload(
  body: unknown
): { ok: true; value: ClockPayload } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Body must be an object." };
  const b = body as Record<string, unknown>;
  const str = (k: string) => (typeof b[k] === "string" ? (b[k] as string).trim() : "");
  const dateISO = str("dateISO");
  const sessionId = str("sessionId");
  const startDisplay = str("startDisplay");
  const endDisplay = str("endDisplay");
  const location = str("location");
  const hours = typeof b.hours === "number" ? b.hours : NaN;

  if (!ISO_DATE.test(dateISO)) return { ok: false, error: "dateISO must be YYYY-MM-DD." };
  if (!sessionId) return { ok: false, error: "sessionId is required." };
  if (!startDisplay || !endDisplay) return { ok: false, error: "start and end times are required." };
  if (!location) return { ok: false, error: "location is required." };
  if (!Number.isFinite(hours) || hours <= 0 || hours >= MAX_HOURS) {
    return { ok: false, error: "hours must be greater than 0 and less than 24." };
  }
  return { ok: true, value: { dateISO, sessionId, startDisplay, endDisplay, hours, location } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/clock.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/clock.ts lib/clock.test.ts
git commit -m "feat: ClockPayload type and validation"
```

---

### Task 3: Session insert in lib/notion.ts

**Files:**
- Modify: `lib/notion.ts` (append near the bottom, after `readClient`)
- Test: `lib/notion.test.ts`

**Interfaces:**
- Consumes: `ClockPayload` from `lib/clock.ts`; `Client`, `requireEnv` already in `lib/notion.ts`.
- Produces: `buildSessionProperties(input: ClockPayload, clientPageId: string): Record<string, unknown>`, `insertSession(input: ClockPayload): Promise<{ id: string }>`

- [ ] **Step 1: Write the failing test**

```ts
// lib/notion.test.ts
import { describe, it, expect } from "vitest";
import { buildSessionProperties } from "@/lib/notion";
import type { ClockPayload } from "@/lib/clock";

const input: ClockPayload = {
  dateISO: "2026-07-16",
  sessionId: "AFP-2026-07-16-0903-1027",
  startDisplay: "9:03 AM",
  endDisplay: "10:27 AM",
  hours: 1.4,
  location: "Remote",
};

describe("buildSessionProperties", () => {
  const p = buildSessionProperties(input, "client-page-id") as any;
  it("writes the ISO date as the title", () => {
    expect(p["Date"].title[0].text.content).toBe("2026-07-16");
  });
  it("stores raw hours and a 30 rate", () => {
    expect(p["Total Hours"].number).toBe(1.4);
    expect(p["Hourly Rate"].number).toBe(30);
  });
  it("marks the row billable and Draft", () => {
    expect(p["Billable"].checkbox).toBe(true);
    expect(p["Billing Status"].select.name).toBe("Draft");
  });
  it("relates to the client page", () => {
    expect(p["Client"].relation[0].id).toBe("client-page-id");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/notion.test.ts`
Expected: FAIL, `buildSessionProperties` is not exported.

- [ ] **Step 3: Write minimal implementation**

```ts
// append to lib/notion.ts
import type { ClockPayload } from "@/lib/clock";

// The one write path, added 2026-07-16 (docs/07-data-gaps.md gap 4, and the read-only rule
// reversal recorded in docs/05-api-routes.md). Insert only: one Draft row per clock-out.
// Draft is the safety net, since Draft never bills until the row is marked Reviewed.
const HOURLY_RATE = 30;

export function buildSessionProperties(
  input: ClockPayload,
  clientPageId: string
): Record<string, unknown> {
  return {
    Date: { title: [{ text: { content: input.dateISO } }] },
    "Session ID": { rich_text: [{ text: { content: input.sessionId } }] },
    "Start Time": { rich_text: [{ text: { content: input.startDisplay } }] },
    "End Time": { rich_text: [{ text: { content: input.endDisplay } }] },
    "Total Hours": { number: input.hours },
    "Hourly Rate": { number: HOURLY_RATE },
    Billable: { checkbox: true },
    "Billing Status": { select: { name: "Draft" } },
    Location: { rich_text: [{ text: { content: input.location } }] },
    Client: { relation: [{ id: clientPageId }] },
  };
}

export async function insertSession(input: ClockPayload): Promise<{ id: string }> {
  const client = new Client({ auth: requireEnv("NOTION_TOKEN") });
  const page = await client.pages.create({
    parent: { type: "data_source_id", data_source_id: requireEnv("NOTION_DS_HOURS") },
    properties: buildSessionProperties(input, requireEnv("NOTION_CLIENT_PAGE")) as any,
  } as any);
  return { id: page.id };
}
```

Note: the `as any` on the create call mirrors the loose Notion typing already used across this file. If the installed `@notionhq/client` rejects the `data_source_id` parent, fall back to `parent: { database_id: "a192465a4bbe442e86a5255db6d65df6" }` (the Hours Worked database id from docs/03-notion-schema.md).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/notion.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/notion.ts lib/notion.test.ts
git commit -m "feat: insertSession writes a Draft Hours Worked row"
```

---

### Task 4: POST /api/clock route

**Files:**
- Create: `app/api/clock/route.ts`
- Test: `app/api/clock/route.test.ts`

**Interfaces:**
- Consumes: `validateClockPayload` from `lib/clock.ts`; `insertSession` from `lib/notion.ts`; `revalidatePath` from `next/cache`.
- Produces: `POST(req: Request): Promise<Response>`

The existing `middleware.ts` already gates every non-open path, so this route returns 401 without the auth cookie with no code here. On success it revalidates `/api/notion/afp` so the new session shows on the next refresh instead of up to 60s later.

- [ ] **Step 1: Write the failing test**

```ts
// app/api/clock/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/notion", () => ({ insertSession: vi.fn(async () => ({ id: "page_123" })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { POST } from "@/app/api/clock/route";
import { insertSession } from "@/lib/notion";
import { revalidatePath } from "next/cache";

const good = {
  dateISO: "2026-07-16",
  sessionId: "AFP-2026-07-16-0903-1027",
  startDisplay: "9:03 AM",
  endDisplay: "10:27 AM",
  hours: 1.4,
  location: "Remote",
};
const post = (body: unknown) =>
  POST(new Request("http://localhost/api/clock", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));

beforeEach(() => vi.clearAllMocks());

describe("POST /api/clock", () => {
  it("inserts a valid session and revalidates the read", async () => {
    const res = await post(good);
    expect(res.status).toBe(201);
    expect(insertSession).toHaveBeenCalledOnce();
    expect(revalidatePath).toHaveBeenCalledWith("/api/notion/afp");
  });
  it("rejects a bad payload without touching Notion", async () => {
    const res = await post({ ...good, hours: 0 });
    expect(res.status).toBe(400);
    expect(insertSession).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/clock/route.test.ts`
Expected: FAIL, cannot resolve `@/app/api/clock/route`.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/api/clock/route.ts
// POST /api/clock. The one write route, added 2026-07-16. Gated by middleware.ts like every
// non-open path, so an unauthenticated call 401s before reaching here. Insert only: it writes
// one Draft Hours Worked row and revalidates the read so the session appears at once.
// See docs/05-api-routes.md.

import { revalidatePath } from "next/cache";
import { validateClockPayload } from "@/lib/clock";
import { insertSession } from "@/lib/notion";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const parsed = validateClockPayload(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  try {
    const { id } = await insertSession(parsed.value);
    revalidatePath("/api/notion/afp");
    return Response.json({ id }, { status: 201 });
  } catch (err) {
    const hint = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: "Notion write failed.", hint: "If this is a permissions error, enable Insert content on the integration. See docs/08-deploy.md." + " " + hint },
      { status: 502 }
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/clock/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/clock/route.ts app/api/clock/route.test.ts
git commit -m "feat: POST /api/clock inserts a session and revalidates the read"
```

---

### Task 5: useClock hook

**Files:**
- Create: `app/useClock.ts`

**Interfaces:**
- Consumes: `todayISO` from `lib/invoice.ts`; `sessionId`, `to12h`, `hoursBetween`, `ClockPayload` from `lib/clock.ts`.
- Produces: `type ClockState = { startedAt: number; dateISO: string; location: string }`, `useClock(onSaved: () => void): { state: ClockState | null; elapsedMs: number; stale: boolean; saving: boolean; error: string | null; clockIn: (location: string) => void; clockOut: () => Promise<void>; discard: () => void }`

This hook holds effects, timers, and localStorage, so it is verified in the browser at Task 7 rather than unit tested (the codebase runs vitest in a node env with no DOM). Its pure inputs are already covered by Task 1.

- [ ] **Step 1: Write the hook**

```ts
// app/useClock.ts
"use client";

// Owns the live clock. Only this in-progress value is persisted, under one localStorage key,
// per the browser-storage amendment in docs/06-ui-spec.md. A completed session goes to Notion
// through POST /api/clock and never to the browser. On a failed save the running clock is
// kept, so nothing is lost.

import { useCallback, useEffect, useRef, useState } from "react";
import { todayISO } from "@/lib/invoice";
import { sessionId, to12h, hoursBetween, type ClockPayload } from "@/lib/clock";

const KEY = "afp.clock.v1";

export type ClockState = { startedAt: number; dateISO: string; location: string };

function read(): ClockState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (
      p && typeof p.startedAt === "number" &&
      typeof p.dateISO === "string" && typeof p.location === "string"
    ) {
      return { startedAt: p.startedAt, dateISO: p.dateISO, location: p.location };
    }
  } catch {
    // fall through
  }
  return null;
}

export function useClock(onSaved: () => void) {
  const [state, setState] = useState<ClockState | null>(null);
  const [now, setNow] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  // Resume a running clock after mount. localStorage is client only, so this cannot run during
  // render or on the server.
  useEffect(() => {
    const s = read();
    if (s) {
      setState(s);
      setNow(Date.now());
    }
  }, []);

  // Tick once a second while clocked in, for the elapsed readout.
  useEffect(() => {
    if (!state) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [state]);

  const clockIn = useCallback((location: string) => {
    const s: ClockState = { startedAt: Date.now(), dateISO: todayISO(), location };
    window.localStorage.setItem(KEY, JSON.stringify(s));
    setError(null);
    setState(s);
    setNow(Date.now());
  }, []);

  const discard = useCallback(() => {
    window.localStorage.removeItem(KEY);
    setState(null);
    setError(null);
  }, []);

  const clockOut = useCallback(async () => {
    if (!state) return;
    const start = new Date(state.startedAt);
    const endMs = Date.now();
    const end = new Date(endMs);
    const payload: ClockPayload = {
      dateISO: state.dateISO,
      sessionId: sessionId(
        state.dateISO, start.getHours(), start.getMinutes(), end.getHours(), end.getMinutes()
      ),
      startDisplay: to12h(start.getHours(), start.getMinutes()),
      endDisplay: to12h(end.getHours(), end.getMinutes()),
      hours: hoursBetween(state.startedAt, endMs),
      location: state.location,
    };
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/clock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body && body.error ? String(body.error) : `Save failed (HTTP ${res.status}).`);
        return; // keep the running clock; nothing is lost
      }
      window.localStorage.removeItem(KEY);
      setState(null);
      onSavedRef.current();
    } catch {
      setError("Could not reach the server. Your clock is still running.");
    } finally {
      setSaving(false);
    }
  }, [state]);

  const stale = Boolean(state && state.dateISO !== todayISO());
  const elapsedMs = state ? Math.max(0, now - state.startedAt) : 0;

  return { state, elapsedMs, stale, saving, error, clockIn, clockOut, discard };
}
```

- [ ] **Step 2: Commit**

```bash
git add app/useClock.ts
git commit -m "feat: useClock hook with localStorage-backed live clock"
```

---

### Task 6: Clock control UI, wired into the topbar

**Files:**
- Create: `app/cockpit/ClockControlView.tsx`
- Create: `app/cockpit/ClockControl.tsx`
- Test: `app/cockpit/ClockControlView.test.tsx`
- Modify: `app/page.tsx` (import and render in the topbar)
- Modify: `app/globals.css` (append clock styles)

**Interfaces:**
- Consumes: `useClock` from `app/useClock.ts`; `elapsed`, `to12h` from `lib/clock.ts`.
- Produces: default export `ClockControl({ onSaved }: { onSaved: () => void })`; named `ClockControlView(props)`.

- [ ] **Step 1: Write the failing test**

```tsx
// app/cockpit/ClockControlView.test.tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ClockControlView } from "@/app/cockpit/ClockControlView";

const base = {
  clockedIn: false,
  elapsedLabel: "0:00:00",
  startLabel: "",
  stale: false,
  saving: false,
  error: null as string | null,
  location: "Remote",
  locations: ["Remote", "Onsite / AFP"] as const,
  onLocation: () => {},
  onClockIn: () => {},
  onClockOut: () => {},
  onDiscard: () => {},
};

describe("ClockControlView", () => {
  it("shows Clock in when clocked out", () => {
    const html = renderToStaticMarkup(<ClockControlView {...base} />);
    expect(html).toContain("Clock in");
    expect(html).not.toContain("Clock out");
  });
  it("shows the elapsed time and Clock out when clocked in", () => {
    const html = renderToStaticMarkup(
      <ClockControlView {...base} clockedIn elapsedLabel="1:23:45" startLabel="9:03 AM" />
    );
    expect(html).toContain("1:23:45");
    expect(html).toContain("Clock out");
    expect(html).toContain("9:03 AM");
  });
  it("shows a discard affordance when the clock is stale", () => {
    const html = renderToStaticMarkup(<ClockControlView {...base} clockedIn stale />);
    expect(html).toContain("Discard");
  });
  it("shows an error message", () => {
    const html = renderToStaticMarkup(<ClockControlView {...base} clockedIn error="Save failed." />);
    expect(html).toContain("Save failed.");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/cockpit/ClockControlView.test.tsx`
Expected: FAIL, cannot resolve `ClockControlView`.

- [ ] **Step 3: Write the presentational view**

```tsx
// app/cockpit/ClockControlView.tsx
// Pure presentational clock control. All state comes in as props so it renders deterministically
// and is checked with renderToStaticMarkup, matching the rest of the cockpit's components.

export type ClockControlViewProps = {
  clockedIn: boolean;
  elapsedLabel: string;
  startLabel: string;
  stale: boolean;
  saving: boolean;
  error: string | null;
  location: string;
  locations: readonly string[];
  onLocation: (v: string) => void;
  onClockIn: () => void;
  onClockOut: () => void;
  onDiscard: () => void;
};

export function ClockControlView(props: ClockControlViewProps) {
  const {
    clockedIn, elapsedLabel, startLabel, stale, saving, error,
    location, locations, onLocation, onClockIn, onClockOut, onDiscard,
  } = props;

  if (!clockedIn) {
    return (
      <div className="clock-control">
        <select
          className="clock-loc"
          aria-label="Location"
          value={location}
          onChange={(e) => onLocation(e.target.value)}
        >
          {locations.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <button className="clock-btn" onClick={onClockIn}>Clock in</button>
      </div>
    );
  }

  return (
    <div className="clock-control">
      <span className="clock-live">
        <span className="clock-dot" aria-hidden="true" />
        <span className="clock-elapsed">{elapsedLabel}</span>
        {startLabel && <span className="clock-since">since {startLabel}</span>}
      </span>
      {stale && <span className="clock-warn">clocked in on a past day</span>}
      <button className="clock-btn" onClick={onClockOut} disabled={saving}>
        {saving ? "Saving..." : "Clock out"}
      </button>
      {stale && <button className="clock-btn" onClick={onDiscard}>Discard</button>}
      {error && <span className="clock-err">{error}</span>}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/cockpit/ClockControlView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the container**

```tsx
// app/cockpit/ClockControl.tsx
"use client";

import { useState } from "react";
import { useClock } from "@/app/useClock";
import { elapsed, to12h } from "@/lib/clock";
import { ClockControlView } from "./ClockControlView";

const LOCATIONS = ["Remote", "Onsite / AFP"] as const;

export default function ClockControl({ onSaved }: { onSaved: () => void }) {
  const { state, elapsedMs, stale, saving, error, clockIn, clockOut, discard } = useClock(onSaved);
  const [location, setLocation] = useState<string>(LOCATIONS[0]);
  const start = state ? new Date(state.startedAt) : null;
  return (
    <ClockControlView
      clockedIn={Boolean(state)}
      elapsedLabel={elapsed(elapsedMs)}
      startLabel={start ? to12h(start.getHours(), start.getMinutes()) : ""}
      stale={stale}
      saving={saving}
      error={error}
      location={location}
      locations={LOCATIONS}
      onLocation={setLocation}
      onClockIn={() => clockIn(location)}
      onClockOut={() => void clockOut()}
      onDiscard={discard}
    />
  );
}
```

- [ ] **Step 6: Wire into the topbar**

In `app/page.tsx`, add the import beside the other cockpit imports:

```tsx
import ClockControl from "./cockpit/ClockControl";
```

Then render it in the topbar, immediately before `<SyncStatus ... />`:

```tsx
        <ClockControl onSaved={refresh} />
        <SyncStatus lastSynced={lastSynced} refreshing={refreshing} error={Boolean(err)} onRefresh={refresh} />
```

- [ ] **Step 7: Append clock styles**

Append to `app/globals.css`. Uses the existing theme tokens so it works across all six themes, and lives inside `.topbar`, which the print block already hides.

```css
/* Clock in / out control. Lives in the topbar, so the @media print block hides it with the
   rest of the console chrome. Amber marks the running state, matching the dial. */
.clock-control {
  display: flex;
  align-items: center;
  gap: 10px;
}
.clock-loc {
  background: transparent;
  border: 1px solid var(--line);
  color: var(--dim);
  font-family: var(--data);
  font-size: 11px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
}
.clock-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: transparent;
  border: 1px solid var(--line);
  color: var(--tx);
  font-family: var(--ui);
  font-weight: 600;
  font-size: 13px;
  padding: 8px 14px;
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 120ms ease;
}
.clock-btn:hover:not(:disabled) {
  border-color: var(--accent);
}
.clock-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.clock-live {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.clock-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--amber);
}
.clock-elapsed {
  font-family: var(--data);
  font-size: 15px;
  font-weight: 600;
  color: var(--tx);
}
.clock-since,
.clock-warn,
.clock-err {
  font-family: var(--data);
  font-size: 11px;
}
.clock-since { color: var(--dim); }
.clock-warn,
.clock-err { color: var(--amber); }
```

- [ ] **Step 8: Run the view test again and commit**

Run: `npx vitest run app/cockpit/ClockControlView.test.tsx`
Expected: PASS.

```bash
git add app/cockpit/ClockControlView.tsx app/cockpit/ClockControl.tsx app/cockpit/ClockControlView.test.tsx app/page.tsx app/globals.css
git commit -m "feat: clock control in the cockpit topbar"
```

---

### Task 7: Docs, Notion capability, and end-to-end verification

**Files:**
- Modify: `docs/06-ui-spec.md` (browser-storage amendment)
- Modify: `docs/05-api-routes.md` (the write route)
- Modify: `docs/08-deploy.md` (enable Insert content)

- [ ] **Step 1: Amend the browser-storage rule**

In `docs/06-ui-spec.md`, extend the storage line so it reads:

```
No browser storage of Notion or billing data. UI preferences (theme, layout, dial metric)
may be stored in localStorage under a single key. The in-progress clock (start time, date,
location) may be stored under one key `afp.clock.v1`, cleared on clock-out; completed
sessions and billing history still never touch the browser. See
docs/superpowers/specs/2026-07-16-clock-in-out-design.md.
```

- [ ] **Step 2: Record the write route**

In `docs/05-api-routes.md`, add that `POST /api/clock` exists, is insert-only, writes one Draft Hours Worked row, is gated by the auth middleware, and revalidates `/api/notion/afp` on success. Note this is the read-only-rule reversal decided 2026-07-16.

- [ ] **Step 3: Note the Notion capability**

In `docs/08-deploy.md`, under the integration setup, add that the integration now needs "Insert content" enabled (in addition to read), and must still leave "Update content" and delete off, so it can add rows but not rewrite or delete billing records.

- [ ] **Step 4: Commit the docs**

```bash
git add docs/06-ui-spec.md docs/05-api-routes.md docs/08-deploy.md
git commit -m "docs: record the clock write route, storage amendment, and Insert capability"
```

- [ ] **Step 5: Enable Insert content (Austin, in Notion)**

At notion.so/my-integrations, open the AFP integration and turn on "Insert content". Leave "Update content" and delete off. This is a prerequisite for a real clock-out to succeed; without it the route returns the "enable Insert content" 502.

- [ ] **Step 6: End-to-end verification in the browser**

With `NOTION_TOKEN` and the other env set and Insert enabled, run the dev server and:
1. Clock in, confirm the elapsed timer ticks and survives a page reload (localStorage).
2. Clock out, confirm a new Draft row appears in the Hours Worked database in Notion with the right date, times, raw hours, rate 30, Billable checked, and the client relation.
3. Confirm the new session appears in the cockpit within a second of clock-out (the revalidate plus refetch), and that the Today and This week dial figures move.
4. Confirm a clock-out with Insert disabled shows the clear "enable Insert content" error and keeps the clock running.

- [ ] **Step 7: Final commit if any verification fixes were needed**

```bash
git add -A
git commit -m "fix: clock-out end-to-end verification adjustments"
```
