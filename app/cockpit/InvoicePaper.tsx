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
