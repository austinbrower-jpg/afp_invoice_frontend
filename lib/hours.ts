// Client-safe derivations for the dashboard. Pure functions, no Notion import beyond the
// erased `Session` type, so this is safe to pull into a "use client" component. The API
// returns raw floats and normalized "H:MM AM/PM" times; everything here reads that Payload
// shape and computes the console's readouts, the day trace geometry, and the unbilled
// figure. Nothing here rounds hours except where a figure is only ever displayed, matching
// the invoice builder's exact-to-two-decimals default. See docs/10-visual-direction.md.

import type { Payload, Session } from "@/lib/notion";

const MINUTES_IN_DAY = 1440;

// A worked session that counts: billable and not a superseded duplicate. This is the same
// eligibility the invoice builder's `eligible` uses at showall=false, kept in sync on
// purpose so a dashboard figure never disagrees with what the builder would bill.
export const isLive = (s: Session): boolean =>
  s.billable && s.status !== "Superseded";

// Start Time / End Time arrive normalized to "7:00 AM" from normalizeTime, but a raw
// "07:00" can still slip through when the source was already 24h, so accept both. Returns
// minutes past local midnight, or null when the field is empty or unreadable rather than
// inventing a time. The day trace skips anything that returns null instead of drawing a
// segment at position zero.
export function parseClock(display: string): number | null {
  const s = (display ?? "").trim();
  if (!s) return null;

  const twelve = s.match(/^(\d{1,2}):(\d{2})\s*([AaPp])\.?[Mm]\.?$/);
  if (twelve) {
    const [, h, m, mer] = twelve;
    let hour = Number(h) % 12;
    if (mer.toLowerCase() === "p") hour += 12;
    return hour * 60 + Number(m);
  }

  const twentyFour = s.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFour) {
    const [, h, m] = twentyFour;
    const hour = Number(h);
    if (hour > 24) return null;
    return hour * 60 + Number(m);
  }

  return null;
}

const pct = (minutes: number): number => (minutes / MINUTES_IN_DAY) * 100;

export type Segment = {
  leftPct: number;
  widthPct: number;
  billable: boolean;
  overlap: boolean; // intersects another billable segment on the same day: a billing error
  label: string;
  startMin: number;
  endMin: number;
};

export type DayTrace = {
  date: string; // ISO
  hours: number; // billable, non-superseded hours logged that day
  segments: Segment[];
  hasOverlap: boolean;
};

// Group a session list into per-day traces, newest day first, capped at `limit` days so the
// strip stays readable. Overlap is computed within a day across billable segments only,
// because two overlapping billable windows double-count real money, which is the one thing
// the trace exists to surface and the current app shows nowhere.
export function buildDayTraces(sessions: Session[], limit = 10): DayTrace[] {
  const byDate = new Map<string, Session[]>();
  for (const s of sessions) {
    if (!s.date) continue;
    const list = byDate.get(s.date) ?? [];
    list.push(s);
    byDate.set(s.date, list);
  }

  const dates = [...byDate.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)).slice(0, limit);

  return dates.map((date) => {
    const rows = byDate.get(date)!;
    const segments: Segment[] = [];

    for (const s of rows) {
      const start = parseClock(s.start);
      const end = parseClock(s.end);
      if (start === null) continue;
      // No end, or a non-positive span from bad entry: draw a hairline marker at the start
      // rather than nothing, so the session is still visible on the trace.
      const rawEnd = end === null || end <= start ? start + 4 : end;
      const widthPct = Math.max(0.5, pct(rawEnd) - pct(start));
      segments.push({
        leftPct: pct(start),
        widthPct,
        billable: isLive(s),
        overlap: false,
        label: `${s.start || "?"} – ${s.end || "?"} · ${s.hours.toFixed(2)} h${
          isLive(s) ? "" : " · non-billable"
        }`,
        startMin: start,
        endMin: rawEnd,
      });
    }

    // Mark billable segments that intersect another billable segment on the same day.
    const billable = segments.filter((seg) => seg.billable);
    for (let i = 0; i < billable.length; i++) {
      for (let j = i + 1; j < billable.length; j++) {
        const a = billable[i];
        const b = billable[j];
        if (a.startMin < b.endMin && b.startMin < a.endMin) {
          a.overlap = true;
          b.overlap = true;
        }
      }
    }

    const hours = rows.filter(isLive).reduce((sum, s) => sum + s.hours, 0);
    return { date, hours, segments, hasOverlap: segments.some((s) => s.overlap) };
  });
}

/* ---------- period aggregates ---------- */

export type Readout = {
  hours: number; // billable, non-superseded
  excluded: number; // non-billable (not superseded) hours in the same window, for the sub
  sessions: number;
};

const sumWindow = (sessions: Session[], inWindow: (s: Session) => boolean): Readout => {
  const scoped = sessions.filter(inWindow);
  const live = scoped.filter(isLive);
  const excluded = scoped
    .filter((s) => !s.billable && s.status !== "Superseded")
    .reduce((sum, s) => sum + s.hours, 0);
  return {
    hours: live.reduce((sum, s) => sum + s.hours, 0),
    excluded,
    sessions: live.length,
  };
};

// Monday-anchored start of the week for an ISO date, using local calendar parts the same
// way lib/invoice does, so a session logged late in America/Chicago does not fall into the
// wrong week because the server clock is UTC.
export function startOfWeekISO(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dow = (date.getDay() + 6) % 7; // 0 = Monday
  date.setDate(date.getDate() - dow);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export const dayReadout = (sessions: Session[], today: string): Readout =>
  sumWindow(sessions, (s) => s.date === today);

export const weekReadout = (sessions: Session[], today: string): Readout => {
  const monday = startOfWeekISO(today);
  return sumWindow(sessions, (s) => s.date >= monday && s.date <= today);
};

export const monthReadout = (sessions: Session[], today: string): Readout => {
  const ym = today.slice(0, 7);
  return sumWindow(sessions, (s) => s.date.startsWith(ym));
};

/* ---------- unbilled ---------- */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Statuses that are already on an invoice and must never be counted as owed. Mirrors
// app/page.tsx BILLED_STATUSES exactly. isLive already drops Superseded, so together these
// match the builder's terminal set (Invoiced, Paid, Superseded). Kept in lockstep on purpose:
// the whole point of the dashboard "Unbilled" figure is that it equals what the builder would
// bill, and a Paid row leaking in here was re-opening the double-billing the builder just closed.
const BILLED_STATUSES = new Set(["invoiced", "paid"]);

export type Unbilled = {
  hours: number;
  amount: number;
  sessions: number;
  since: string; // human label: last invoice number, or "this month"
};

// The exact set the invoice builder would default-select under its Unbilled preset: billable,
// not superseded, not already invoiced or paid, not in the future, and dated after the last
// invoice's period, or from the month start when there is no usable last invoice. Mirrors the
// builder's unbilledStart + the today bound + BILLED_STATUSES so the two never disagree. See
// app/page.tsx.
export function unbilledSessions(payload: Payload, today: string): Session[] {
  const validEnd =
    payload.lastInvoice && ISO_DATE.test(payload.lastInvoice.periodEnd)
      ? payload.lastInvoice.periodEnd
      : null;
  const monthStart = today.slice(0, 8) + "01";
  return payload.hours.filter(
    (s) =>
      isLive(s) &&
      !BILLED_STATUSES.has(s.billingStatus) &&
      s.date <= today &&
      (validEnd ? s.date > validEnd : s.date >= monthStart)
  );
}

// The money the dashboard reports as owed right now. Amount is the raw exact figure, matching
// the builder's exact-to-two-decimals default (docs/07 gap 6).
export function unbilled(payload: Payload, today: string): Unbilled {
  const scoped = unbilledSessions(payload, today);
  const validEnd =
    payload.lastInvoice && ISO_DATE.test(payload.lastInvoice.periodEnd);
  return {
    hours: scoped.reduce((sum, s) => sum + s.hours, 0),
    amount: scoped.reduce((sum, s) => sum + s.hours * s.rate, 0),
    sessions: scoped.length,
    since: validEnd ? payload.lastInvoice!.number : "this month",
  };
}

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
    if (!ISO_DATE.test(s.date)) continue;
    const w = ensure(startOfWeekISO(s.date));
    const dollars = s.hours * s.rate;
    w.hours += s.hours;
    w.amount += dollars;
    if (BILLED_STATUSES.has(s.billingStatus)) w.collected += dollars;
    else w.owed += dollars;
  }

  return [...byWeek.values()]
    .sort((a, b) => (a.weekStart < b.weekStart ? 1 : a.weekStart > b.weekStart ? -1 : 0))
    .slice(0, weeks);
}
