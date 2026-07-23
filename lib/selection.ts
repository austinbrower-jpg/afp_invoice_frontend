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
export const BILLED_STATUSES = new Set(["invoiced", "paid"]);
export const isTerminal = (r: Pick<Session, "status" | "billingStatus">): boolean =>
  BILLED_STATUSES.has(r.billingStatus) || r.status === "Superseded";

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
    .filter((r) => r.billable && !isTerminal(r))
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
    .filter((r) => BILLED_STATUSES.has(r.billingStatus))
    .forEach((r) =>
      f.push(
        `<b>${esc(r.sid)}</b> is already marked <b>${esc(r.billingStatus)}</b>${
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
