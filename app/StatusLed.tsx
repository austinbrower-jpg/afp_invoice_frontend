"use client";

// Billing Status as a signal light rather than a text pill, per docs/10-visual-direction.md.
// Ring versus fill carries the meaning, not colour alone, so Draft and Invoiced stay
// distinguishable without relying on amber and green reading correctly on every display or
// to every eye. The status name stays as a plain label beside it: the LED is the signal,
// the word is what a screen reader gets. Unknown statuses fall back to the Draft ring rather
// than disappearing, because a status we do not recognise is still a status.
//
// Shared by the invoice builder's ledger and the dashboard manifest so the one mapping from
// status to light lives in a single place.

const LED_CLASS: Record<string, string> = {
  Draft: "led-draft",
  Reviewed: "led-reviewed",
  "Ready to Invoice": "led-ready",
  Invoiced: "led-invoiced",
  Paid: "led-paid",
  Superseded: "led-superseded",
};

export function StatusLed({ status }: { status: string }) {
  const cls = LED_CLASS[status] ?? "led-draft";
  return <span className={`led ${cls}`} role="img" aria-label={`Status: ${status}`} />;
}
