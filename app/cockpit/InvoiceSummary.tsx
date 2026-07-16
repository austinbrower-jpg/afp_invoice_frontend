// The compact invoice card shown only in the Instruments focus layout (CSS toggles it). It sits
// beside the full paper, which stays in the DOM and hidden on screen so print is unaffected.
// "Build invoice" switches back to a paper-forward layout.

import { money } from "@/lib/invoice";

export function InvoiceSummary({
  sessions,
  amount,
  onBuild,
}: {
  sessions: number;
  amount: number;
  onBuild: () => void;
}) {
  return (
    <div className="invoice-summary">
      <div className="eyebrow">Selected to bill</div>
      <div className="isum-amt mono">{money(amount)}</div>
      <div className="isum-sub mono">
        {sessions} session{sessions === 1 ? "" : "s"}
      </div>
      <button className="print-btn" onClick={onBuild}>Build invoice</button>
    </div>
  );
}
