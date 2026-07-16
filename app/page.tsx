"use client";

// Ported from prototype/invoice-builder.html. Same markup, same class names, same
// calculation logic, same print CSS. The DATA const is gone and the payload comes from
// GET /api/notion/afp instead. Nothing else about the invoice changed.
//
// The markup is deliberately identical to the prototype's because the stylesheet, and
// especially the @media print block, is written against these exact classes. Renaming
// anything here is a change to the deliverable.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Payload, Session } from "@/lib/notion";
import {
  addDays,
  fmtDate,
  money,
  nextInvoiceNumber,
  roundHours,
  shortDate,
  todayISO,
} from "@/lib/invoice";

type Mode = "invoice" | "summary" | "notes" | "none";

// `key` is the ISO date, carried only so entries can sort chronologically. See the
// sort in `entries` below for why the displayed stamp cannot be sorted on.
type Entry = { h: string; stamp: string; body: string; key: string };

export default function Page() {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<{ error: string; hint?: string } | null>(null);

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

  /* ---------- boot: default to everything not yet invoiced ---------- */
  useEffect(() => {
    let live = true;
    fetch("/api/notion/afp")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw body;
        return body as Payload;
      })
      .then((d) => {
        if (!live) return;
        const today = todayISO();
        // Opens ready: the day after the last invoice through today, every eligible
        // session pre-selected. The common case is "bill me for everything since last
        // time" and it should take zero clicks before Cmd+P. See docs/06-ui-spec.md.
        const start = d.lastInvoice
          ? addDays(d.lastInvoice.periodEnd, 1)
          : today.slice(0, 8) + "01";
        setData(d);
        setInvno(nextInvoiceNumber(d.lastInvoice?.number));
        setInvdate(today);
        setDuedate(addDays(today, 15));
        setFrom(start);
        setTo(today);
        setPicked(autoSelect(d.hours, start, today, false));
      })
      .catch((e) => {
        if (!live) return;
        setErr(
          e && typeof e === "object" && "error" in e
            ? (e as { error: string; hint?: string })
            : { error: "Could not reach /api/notion/afp.", hint: String(e) }
        );
      });
    return () => {
      live = false;
    };
  }, []);

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
  const selected = useMemo(
    () =>
      rows
        .filter((r) => picked.has(r.url))
        .sort((a, b) => a.date.localeCompare(b.date) || a.sid.localeCompare(b.sid)),
    [rows, picked]
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
    if (p === "unbilled")
      setRange(
        data.lastInvoice ? addDays(data.lastInvoice.periodEnd, 1) : today.slice(0, 8) + "01",
        today
      );
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
        return {
          h: w.title,
          stamp: `${fmtDate(w.date)} · ${hrs.toFixed(2)} h`,
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

  const runnerHours = selected.reduce((s, r) => s + roundHours(r.hours, round), 0);
  const runnerAmt = selected.reduce((s, r) => s + roundHours(r.hours, round) * r.rate, 0);

  // The number you are about to charge someone is the point of the tool. Let it move.
  // Console only: the paper stays inert, because it is a document, not an instrument.
  const shownHours = useCountUp(runnerHours);
  const shownAmt = useCountUp(runnerAmt);

  const days = [...new Set([...visible].sort(byDayDesc).map((r) => r.date))];

  const [wiping, setWiping] = useState(false);
  const savePdf = () => {
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
          <b>Invoice Builder</b>
          <span>{data?.client.name ?? "Anytime Fuel Pros"}</span>
        </div>
        <div className="rangebox">
          <label htmlFor="from">From</label>
          <input
            type="date"
            id="from"
            value={from}
            onChange={(e) => setRange(e.target.value, to)}
          />
          <label htmlFor="to">To</label>
          <input
            type="date"
            id="to"
            value={to}
            onChange={(e) => setRange(from, e.target.value)}
          />
          <div className="chips">
            <button className="chip" onClick={() => preset("unbilled")}>
              Unbilled
            </button>
            <button className="chip" onClick={() => preset("week")}>
              This week
            </button>
            <button className="chip" onClick={() => preset("month")}>
              This month
            </button>
            <button className="chip" onClick={() => preset("all")}>
              All
            </button>
          </div>
        </div>
        <button className="print-btn" onClick={savePdf}>
          Save PDF
        </button>
      </div>

      <div className="stage">
        <aside className="rail">
          <h2>Sessions in range</h2>
          <div id="ledger">
            {!visible.length ? (
              <p style={{ color: "var(--dim)", fontSize: 12, padding: "8px 2px" }}>
                {data ? `No sessions between ${from} and ${to}.` : "Loading sessions…"}
              </p>
            ) : (
              days.map((day) => {
                const dayRows = [...visible].sort(byDayDesc).filter((r) => r.date === day);
                const dayH = dayRows.reduce(
                  (s, r) => s + (picked.has(r.url) ? r.hours : 0),
                  0
                );
                return (
                  <div className="day" key={day}>
                    <div className="day-head">
                      <span className="d">{day}</span>
                      <span className="h">{dayH ? dayH.toFixed(2) + " h" : "—"}</span>
                    </div>
                    {dayRows.map((r) => {
                      const locked = r.status === "Invoiced" || r.status === "Superseded";
                      return (
                        <label
                          className={`sess ${picked.has(r.url) ? "on" : ""} ${
                            locked ? "locked" : ""
                          }`}
                          key={r.url}
                        >
                          <input
                            type="checkbox"
                            checked={picked.has(r.url)}
                            onChange={() => toggle(r.url)}
                          />
                          <span>
                            <span className="sid">{r.sid}</span>
                            <span className="meta">
                              <span style={{ flexBasis: "100%" }}>
                                {r.start} – {r.end}
                                {r.location ? " · " + r.location : ""}
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
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>

          <div className="runner">
            <div className="row">
              <span>Selected</span>
              <b className="mono">
                {selected.length} session{selected.length === 1 ? "" : "s"}
              </b>
            </div>
            <div className="row">
              <span>Hours</span>
              <b className="mono">{shownHours.toFixed(2)}</b>
            </div>
            <div className="row total">
              <span>Amount</span>
              <b className="mono">{money(shownAmt)}</b>
            </div>
          </div>

          <h2>Invoice</h2>
          <div className="opt">
            <div className="field">
              <label htmlFor="invno">Number</label>
              <input
                type="text"
                id="invno"
                value={invno}
                onChange={(e) => setInvno(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="invdate">Invoice date</label>
              <input
                type="date"
                id="invdate"
                value={invdate}
                onChange={(e) => {
                  setInvdate(e.target.value);
                  syncDue(terms, e.target.value);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="terms">Terms</label>
              <select
                id="terms"
                value={terms}
                onChange={(e) => {
                  setTerms(e.target.value);
                  syncDue(e.target.value, invdate);
                }}
              >
                <option>Net 15</option>
                <option>Net 30</option>
                <option>Due on receipt</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="duedate">Due</label>
              <input
                type="date"
                id="duedate"
                value={duedate}
                onChange={(e) => setDuedate(e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="detail">Work detail</label>
            <select
              id="detail"
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
            >
              <option value="invoice">Invoice descriptions (client-facing)</option>
              <option value="summary">Summaries only (short)</option>
              <option value="notes">Session notes (verbatim)</option>
              <option value="none">Line items only</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="round">Hour rounding</label>
            <select
              id="round"
              value={String(round)}
              onChange={(e) => setRound(parseFloat(e.target.value))}
            >
              <option value="0">Exact (2 decimals)</option>
              <option value="0.25">Nearest quarter hour</option>
              <option value="0.1">Nearest tenth</option>
            </select>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={showall}
              onChange={(e) => setShowall(e.target.checked)}
            />{" "}
            Show non-billable and superseded
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={showsid}
              onChange={(e) => setShowsid(e.target.checked)}
            />{" "}
            Print session IDs on line items
          </label>

          <h2>Data flags</h2>
          <div className={`flags${flags.length ? "" : " clean"}`}>
            {flags.length ? (
              flags.map((f, i) => (
                <p key={i}>
                  <span dangerouslySetInnerHTML={{ __html: f }} />
                </p>
              ))
            ) : (
              <p>
                <span>Nothing to flag. Selection is clean.</span>
              </p>
            )}
          </div>
        </aside>

        <main className="paperstage">
          <div className="paper">
            {err ? (
              <div className="loadstate">
                <b>Notion read failed.</b>
                {err.error}
                {err.hint && <div className="hint">{err.hint}</div>}
              </div>
            ) : !data ? (
              <div className="loadstate">Reading Notion…</div>
            ) : !lines.length ? (
              <div className="empty">
                Pick sessions on the left and the invoice builds itself here.
              </div>
            ) : (
              <>
                <div className="inv-head">
                  <div>
                    <h1>Invoice</h1>
                    <div className="sub" contentEditable suppressContentEditableWarning>
                      Independent contractor · digital systems &amp; automation
                    </div>
                  </div>
                  <div className="inv-no">
                    <div className="n">{invno}</div>
                    <div className="dates">
                      Issued {fmtDate(invdate)}
                      <br />
                      Due {fmtDate(duedate)} · {terms}
                    </div>
                  </div>
                </div>

                <div className="parties">
                  <div>
                    <div className="k">From</div>
                    <div className="v" contentEditable suppressContentEditableWarning>
                      {data.from}
                    </div>
                  </div>
                  <div>
                    <div className="k">Bill to</div>
                    <div className="v" contentEditable suppressContentEditableWarning>
                      {data.client.billTo}
                    </div>
                  </div>
                </div>

                <div className="period">
                  <span>Service period</span>
                  <b>
                    {fmtDate(lines[0].date)} — {fmtDate(lines[lines.length - 1].date)}
                  </b>
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
                          <b>
                            {l.start} – {l.end}
                            {l.location && l.location !== "Not specified"
                              ? " · " + l.location
                              : ""}
                          </b>
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
                      <tr>
                        <td>Billable hours</td>
                        <td>{totalHours.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td>Rate</td>
                        <td>{rates.length === 1 ? money(rates[0]) + " / hr" : "mixed"}</td>
                      </tr>
                      <tr className="grand">
                        <td>Total due</td>
                        <td>{money(totalAmt)}</td>
                      </tr>
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
                  <span>
                    {invno} · {lines.length} session{lines.length > 1 ? "s" : ""} ·{" "}
                    {totalHours.toFixed(2)} h
                  </span>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ---------- helpers, lifted from the prototype ---------- */

const byDayDesc = (a: Session, b: Session) =>
  b.date.localeCompare(a.date) || a.sid.localeCompare(b.sid);

const inRange = (r: Session, from: string, to: string) => r.date >= from && r.date <= to;

// Eligible means Billable is true and status is neither Invoiced nor Superseded. The
// toggle reveals the excluded rows greyed rather than hiding them, because a missing
// session should never look like data loss. See docs/06-ui-spec.md.
const eligible = (r: Session, showall: boolean) =>
  showall ? true : r.billable && r.status !== "Superseded";

function autoSelect(hours: Session[], from: string, to: string, showall: boolean) {
  const next = new Set<string>();
  hours
    .filter((r) => inRange(r, from, to) && eligible(r, showall))
    .filter((r) => r.billable && r.status !== "Invoiced" && r.status !== "Superseded")
    .forEach((r) => next.add(r.url));
  return next;
}

// Billing Status as a signal light rather than a text pill, per docs/10. Ring versus
// fill carries the meaning, not colour alone. The status name stays as a plain label
// next to it: the LED is the signal, the word is what makes it readable and what a
// screen reader gets. Unknown statuses fall back to the Draft ring rather than
// disappearing, because a status we do not recognise is still a status.
const LED_CLASS: Record<string, string> = {
  Draft: "led-draft",
  Reviewed: "led-reviewed",
  "Ready to Invoice": "led-ready",
  Invoiced: "led-invoiced",
  Paid: "led-paid",
  Superseded: "led-superseded",
};

function StatusLed({ status }: { status: string }) {
  const cls = LED_CLASS[status] ?? "led-draft";
  return <span className={`led ${cls}`} role="img" aria-label={`Status: ${status}`} />;
}

// Bounded count-up: steps the displayed value for a fixed ~240ms after a change and
// stops. Not a persistent render loop, which is what docs/10's Performance section
// actually prohibits. Drops out under reduced motion, where the value simply snaps.
//
// The number this animates is the amount you are about to charge someone, so the
// animation is never allowed to be the reason it is wrong. requestAnimationFrame does
// not fire in a hidden or backgrounded tab, which would strand the display on its
// starting value: the total read $0.00 while the real figure was $647.70. So the target
// is guaranteed three ways: snap immediately if the page is hidden or motion is
// reduced, a guard timer that lands the value even if no frame ever runs, and a final
// settle on teardown. Motion is the garnish; the figure is the point.
function useCountUp(target: number, ms = 240): number {
  const [shown, setShown] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;

    if (reduce || document.hidden || from === target) {
      fromRef.current = target;
      setShown(target);
      return;
    }

    let raf: number | null = null;
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      fromRef.current = target;
      setShown(target);
    };

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - t, 3); // ease-out: moves, then settles
      if (t < 1) {
        setShown(from + (target - from) * e);
        raf = requestAnimationFrame(tick);
      } else settle();
    };
    raf = requestAnimationFrame(tick);

    // Backstop. If no frame ever runs, this still lands the true value.
    const guard = window.setTimeout(settle, ms + 120);

    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      window.clearTimeout(guard);
      settle();
    };
  }, [target, ms]);

  return shown;
}

// The panel names specific problems in the current selection, not generic warnings.
// Flags are advisory. See docs/06-ui-spec.md.
function buildFlags(data: Payload, rows: Session[]): string[] {
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
    .filter((r) => r.status === "Invoiced")
    .forEach((r) =>
      f.push(
        `<b>${esc(r.sid)}</b> is already marked <b>Invoiced</b>${
          data.lastInvoice ? ` (on ${esc(data.lastInvoice.number)})` : ""
        }. Double billing risk.`
      )
    );
  rows
    .filter((r) => !r.billable)
    .forEach((r) => f.push(`<b>${esc(r.sid)}</b> is marked non-billable.`));
  return f;
}
