"use client";

// Ported from prototype/invoice-builder.html. Same markup, same class names, same
// calculation logic, same print CSS. The DATA const is gone and the payload comes from
// GET /api/notion/afp instead. Nothing else about the invoice changed.
//
// The markup is deliberately identical to the prototype's because the stylesheet, and
// especially the @media print block, is written against these exact classes. Renaming
// anything here is a change to the deliverable.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  fmtDate,
  money,
  nextInvoiceNumber,
  roundHours,
  todayISO,
} from "@/lib/invoice";
import {
  autoSelect,
  buildFlags,
  byDayDesc,
  eligible,
  inRange,
  unbilledStart,
  type Mode,
} from "@/lib/selection";
import { weeklyEarnings, dayReadout, weekReadout, monthReadout, unbilled } from "@/lib/hours";
import { useAfpData } from "./useAfpData";
import { useCountUp } from "./useCountUp";
import { useSettings } from "./useSettings";
import { SyncStatus } from "./SyncStatus";
import { SettingsPanel } from "./cockpit/SettingsPanel";
import InstrumentCluster from "./cockpit/InstrumentCluster";
import { HoursGauge } from "./dashboard/HoursGauge";
import EarningsByWeek from "./cockpit/EarningsByWeek";
import SessionManifest from "./cockpit/SessionManifest";
import InvoiceControls from "./cockpit/InvoiceControls";
import DataFlags from "./cockpit/DataFlags";
import InvoicePaper, { type Entry } from "./cockpit/InvoicePaper";

export default function Page() {
  // Notion stays synced through this hook: a background refetch on window focus and on a slow
  // interval, plus a manual refresh, all hitting the same 60s-cached route. It replaces the
  // one-shot boot fetch this component used to own. See app/useAfpData.ts.
  const { data, error: err, lastSynced, refreshing, refresh } = useAfpData();
  const { settings, setTheme, setLayout, setDialMetric } = useSettings();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const [invno, setInvno] = useState("");
  const [invdate, setInvdate] = useState("");
  const [terms, setTerms] = useState("Net 15");
  const [duedate, setDuedate] = useState("");
  const [mode, setMode] = useState<Mode>("invoice");
  const [round, setRound] = useState(0);
  const [showall, setShowall] = useState(false);
  const [showsid, setShowsid] = useState(true);

  // Client-resolved today, the same pattern the dashboard uses: server and client can
  // disagree on the date near midnight, so this waits for the client clock after mount
  // rather than trusting a server-rendered value. The instrument cluster renders at rest
  // until this resolves.
  const [today2, setToday2] = useState<string | null>(null);
  useEffect(() => {
    setToday2(todayISO());
  }, []);

  /* ---------- boot: default to everything not yet invoiced ----------
     Runs exactly once, when the first payload arrives. Later background refreshes from
     useAfpData replace `data` and flow through the memos below, but must never re-run this:
     a poll landing mid-edit would otherwise wipe the range and reset the selection, which is
     how you bill the wrong week. Opens ready per docs/06-ui-spec.md: the day after the last
     invoice through today, every eligible session pre-selected, zero clicks before Cmd+P. */
  const booted = useRef(false);
  useEffect(() => {
    if (!data || booted.current) return;
    booted.current = true;
    const today = todayISO();
    const start = unbilledStart(data, today);
    setInvno(nextInvoiceNumber(data.lastInvoice?.number));
    setInvdate(today);
    setDuedate(addDays(today, 15));
    setFrom(start);
    setTo(today);
    setPicked(autoSelect(data.hours, start, today, false));
  }, [data]);

  /* ---------- selection ---------- */
  // Any range change clears and re-runs auto-select. Keeping stale selections from a
  // previous range is how you bill the wrong week. See docs/06-ui-spec.md.
  const setRange = useCallback(
    (f: string, t: string) => {
      setFrom(f);
      setTo(t);
      if (data) setPicked(autoSelect(data.hours, f, t, showall));
    },
    [data, showall]
  );

  const rows = data?.hours ?? [];
  const visible = useMemo(
    () => rows.filter((r) => inRange(r, from, to) && eligible(r, showall)),
    [rows, from, to, showall]
  );
  // Only rows that are picked AND still in range AND still eligible under the current showall
  // are billed. Without the eligibility re-check, checking a superseded row with "Show
  // non-billable and superseded" on, then turning it off, would hide the row while it stayed
  // on the invoice and in the total, with no way to see or uncheck it. See docs/06-ui-spec.md.
  const selected = useMemo(
    () =>
      rows
        .filter((r) => picked.has(r.url) && inRange(r, from, to) && eligible(r, showall))
        .sort((a, b) => a.date.localeCompare(b.date) || a.sid.localeCompare(b.sid)),
    [rows, picked, from, to, showall]
  );

  const toggle = (url: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });

  const preset = (p: string) => {
    if (!data) return;
    const today = todayISO();
    if (p === "unbilled") setRange(unbilledStart(data, today), today);
    if (p === "week") setRange(addDays(today, -6), today);
    if (p === "month") setRange(today.slice(0, 8) + "01", today);
    if (p === "all") setRange(today.slice(0, 4) + "-01-01", today);
  };

  const syncDue = (t: string, d: string) =>
    setDuedate(t === "Net 15" ? addDays(d, 15) : t === "Net 30" ? addDays(d, 30) : d);

  /* ---------- derived ---------- */
  const lines = useMemo(
    () =>
      selected.map((r) => ({
        ...r,
        billed: roundHours(r.hours, round),
        amount: roundHours(r.hours, round) * r.rate,
      })),
    [selected, round]
  );
  const totalHours = lines.reduce((s, l) => s + l.billed, 0);
  const totalAmt = lines.reduce((s, l) => s + l.amount, 0);
  const rates = [...new Set(lines.map((l) => l.rate))];

  const entries: Entry[] = useMemo(() => {
    if (!data || mode === "none") return [];
    if (mode === "notes") {
      // Already in date order: `selected` sorts by date before this runs.
      return lines
        .filter((l) => l.notes)
        .map((l) => ({
          h: fmtDate(l.date),
          stamp: `${l.sid} · ${l.start}–${l.end} · ${l.billed.toFixed(2)} h`,
          body: l.notes as string,
          key: l.date,
        }));
    }
    // Deduplicated by Work Done row and stamped with the hours that rolled into them,
    // because three sessions on July 14 all point at one description.
    const ids = [...new Set(lines.flatMap((l) => l.work))];
    return ids
      .map((id) => {
        const w = data.workDone[id];
        if (!w) return null;
        const hrs = lines
          .filter((l) => l.work.includes(id))
          .reduce((s, l) => s + l.billed, 0);
        const stamped = fmtDate(w.date);
        return {
          h: w.title,
          stamp: stamped
            ? `${stamped} · ${hrs.toFixed(2)} h`
            : `${hrs.toFixed(2)} h`,
          body: mode === "summary" ? w.summary : w.invoice,
          key: w.date,
        };
      })
      .filter((e): e is Entry => e !== null)
      // Sort on the ISO date, not the rendered stamp. The prototype sorted on the
      // stamp, which is formatted text like "Jul 10, 2026", so "Jul 10" sorted ahead
      // of "Jul 8" and the work entries printed out of order whenever a selection
      // spanned single and double digit days of one month. Jul 8 to Jul 10 does it,
      // which is the exact span AFP-2026-001 covered. The line items table was always
      // ordered correctly because it sorts on date, so the two halves of the same
      // invoice disagreed.
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [data, lines, mode]);

  const flags = useMemo(() => (data ? buildFlags(data, selected) : []), [data, selected]);

  const weeks = useMemo(
    () => (data && today2 ? weeklyEarnings(data, today2, 6) : []),
    [data, today2]
  );

  const dial = useMemo(() => {
    const rest = { value: 0, unit: "h" as const, fillPercent: 0, foot: "of 60 h target", label: "Hours this month", ariaLabel: "dial at rest" };
    if (!data || !today2) return rest;
    const m = settings.dialMetric;
    if (m === "today") {
      const h = dayReadout(data.hours, today2).hours;
      return { value: h, unit: "h" as const, fillPercent: (h / 8) * 100, foot: "of 8 h day", label: "Hours today", ariaLabel: `${h.toFixed(1)} of 8 hours today` };
    }
    if (m === "week") {
      const h = weekReadout(data.hours, today2).hours;
      return { value: h, unit: "h" as const, fillPercent: (h / 40) * 100, foot: "of 40 h week", label: "Hours this week", ariaLabel: `${h.toFixed(1)} of 40 hours this week` };
    }
    if (m === "unbilled") {
      const u = unbilled(data, today2);
      return { value: u.amount, unit: "$" as const, fillPercent: (u.hours / 60) * 100, foot: `${u.sessions} session${u.sessions === 1 ? "" : "s"} owed`, label: "Unbilled", ariaLabel: `${money(u.amount)} unbilled` };
    }
    const h = monthReadout(data.hours, today2).hours;
    return { value: h, unit: "h" as const, fillPercent: (h / 60) * 100, foot: "of 60 h target", label: "Hours this month", ariaLabel: `${h.toFixed(1)} of 60 hours this month` };
  }, [settings.dialMetric, data, today2]);

  const runnerHours = selected.reduce((s, r) => s + roundHours(r.hours, round), 0);
  const runnerAmt = selected.reduce((s, r) => s + roundHours(r.hours, round) * r.rate, 0);

  // The number you are about to charge someone is the point of the tool. Let it move.
  // Console only: the paper stays inert, because it is a document, not an instrument.
  const shownHours = useCountUp(runnerHours);
  const shownAmt = useCountUp(runnerAmt);

  const days = [...new Set([...visible].sort(byDayDesc).map((r) => r.date))];

  const [wiping, setWiping] = useState(false);
  const savePdf = () => {
    // Nothing selected means the paper is showing the "pick sessions" prompt, not an invoice.
    // Printing here produced a blank page. Refuse rather than save an empty PDF; the button is
    // also disabled in this state, this guards the reduced-motion and programmatic paths too.
    if (!lines.length) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      window.print();
      return;
    }
    setWiping(true);
    window.setTimeout(() => {
      window.print();
      setWiping(false);
    }, 270);
  };

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
        <SettingsPanel
          settings={settings}
          setTheme={setTheme}
          setLayout={setLayout}
          setDialMetric={setDialMetric}
        />
        <button className="print-btn" onClick={savePdf} disabled={!lines.length}>
          Save PDF
        </button>
      </div>

      <div className="cockpit-top">
        <InstrumentCluster data={data} today={today2} />
      </div>

      <div className="cockpit-split">
        <aside className="cockpit-console">
          <div className="dial-card">
            <h2 className="eyebrow">{dial.label}</h2>
            <HoursGauge
              value={dial.value}
              unit={dial.unit}
              fillPercent={dial.fillPercent}
              foot={dial.foot}
              ariaLabel={dial.ariaLabel}
            />
          </div>

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
}
