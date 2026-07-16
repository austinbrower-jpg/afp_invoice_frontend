// Calculation and formatting helpers lifted from prototype/invoice-builder.html.
// This math is already correct and tested against a real invoice: the four Invoiced
// sessions sum to 16.45 hours and $493.50, which is what AFP-2026-001 billed. Do not
// "improve" the rounding. See docs/02-architecture.md.

export const money = (n: number): string =>
  "$" +
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Hours dates are validated upstream (assertDatesUsable), but Work Done dates are not, so a
// blank one must format to "" rather than the string "Invalid Date". Callers that build a
// stamp check for the empty result and drop the date segment.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const fmtDate = (iso: string): string => {
  if (!ISO_DATE.test(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const shortDate = (iso: string): string => {
  if (!ISO_DATE.test(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

export const addDays = (iso: string, n: number): string => {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(y, m - 1, d + n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(
    t.getDate()
  ).padStart(2, "0")}`;
};

// Exact to two decimals is the default because AFP-2026-001 billed 16.45 hours exactly.
// That is the established precedent with this client and changing the rule mid-contract
// invites a question you do not want to answer. See gap 6 in docs/07-data-gaps.md.
export const roundHours = (h: number, step: number): number => {
  if (!step) return Math.round(h * 100) / 100;
  return Math.round(h / step) * step;
};

// The prototype hardcoded "2026-07-15" as today because it was a static fixture. Live
// code computes it. Local date, not UTC: a session logged in America/Chicago should not
// land on tomorrow's range because the server is on UTC. See docs/06-ui-spec.md.
export const todayISO = (): string => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(
    t.getDate()
  ).padStart(2, "0")}`;
};

// Suggested from lastInvoice and editable, per docs/06-ui-spec.md. Format is
// AFP-YYYY-NNN. Bump the trailing counter and leave the rest alone. If the number does
// not parse, hand back the year's first and let the user correct it rather than guess.
export const nextInvoiceNumber = (last: string | null | undefined): string => {
  const year = todayISO().slice(0, 4);
  if (!last) return `AFP-${year}-001`;
  const m = last.match(/^(.*?)(\d+)$/);
  if (!m) return `AFP-${year}-001`;
  const [, prefix, digits] = m;
  return prefix + String(Number(digits) + 1).padStart(digits.length, "0");
};
