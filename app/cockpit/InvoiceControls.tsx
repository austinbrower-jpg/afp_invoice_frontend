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
