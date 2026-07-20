// A self-contained invoice page for the print-layout regression test. It stitches the REAL
// app/globals.css together with the same .paper markup app/cockpit/InvoicePaper.tsx renders,
// filled with enough line items and work entries to span several Letter pages.
//
// The print-layout regression is purely CSS plus markup, so this reproduces it faithfully with
// no Next server and no Notion token. The logos are inline data-URI SVGs at the real assets'
// aspect ratios (the horizontal wordmark is ~3:1, the client badge ~1.2:1) so the header geometry
// matches the shipped PNGs without pulling binary fixtures into the test.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CSS_PATH = resolve(__dirname, "../app/globals.css");

function b64(s: string): string {
  return Buffer.from(s, "utf8").toString("base64");
}
function letterheadSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3000 1000"><rect width="3000" height="1000" fill="#14161a"/><text x="120" y="620" font-size="360" fill="#fff" font-family="sans-serif">BATTLE BOUND</text></svg>`;
}
function clientSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1160 976"><rect width="1160" height="976" fill="#6366f1"/><text x="120" y="540" font-size="220" fill="#fff" font-family="sans-serif">AFP</text></svg>`;
}

function lineItems(n: number): string {
  const rows: string[] = [];
  for (let i = 0; i < n; i++) {
    const day = 3 + i;
    rows.push(`
      <tr>
        <td class="date-c">Jul ${day}</td>
        <td class="desc">
          <b>09:00 &ndash; 13:30 &middot; Anytime Fuel Pros HQ, Bakersfield CA</b>
          <small>SESSION-2026-07-${String(day).padStart(2, "0")}-A</small>
        </td>
        <td class="r">4.50</td>
        <td class="r">$95.00</td>
        <td class="r">$427.50</td>
      </tr>`);
  }
  return rows.join("");
}

function workEntries(n: number): string {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(`
      <div class="entry">
        <h4>Dispatch automation and Notion sync hardening</h4>
        <div class="stamp">Jul ${3 + i}, 2026 &middot; 4.50 h</div>
        <p>Rebuilt the fuel-dispatch intake so inbound tickets land in the right queue without manual triage. Reconciled the Notion mirror against the source records, added retry and backoff on the sync worker, and verified the nightly rollups match the operational dashboard end to end.</p>
      </div>`);
  }
  return out.join("");
}

// Mirrors the live DOM tree: .station > .cockpit-split > (.cockpit-console) + .paperstage > .paper
export function buildInvoiceHtml(lines = 16, entries = 6): string {
  const css = readFileSync(CSS_PATH, "utf8");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>${css}</style>
</head>
<body>
<div class="station">
  <div class="topbar"><div class="brand"><b>AFP Cockpit</b><span>Anytime Fuel Pros</span></div></div>
  <div class="cockpit-top"><div class="gauges"><div class="g"><div class="v">x</div></div></div></div>
  <div class="cockpit-split">
    <aside class="cockpit-console"><h2>Sessions in range</h2><div class="runner"><div class="row total"><span>Amount</span><b>$6,840.00</b></div></div></aside>
    <main class="paperstage">
      <div class="invoice-summary"><div class="isum-amt">$6,840.00</div></div>
      <div class="paper">
        <div class="inv-head">
          <img class="letterhead" src="data:image/svg+xml;base64,${b64(letterheadSvg())}" alt="Battle Bound Branding LLC" />
          <div class="inv-title">
            <h1>Invoice</h1>
            <div class="inv-no">
              <span class="n">AFP-2026-004</span>
              <span class="dates">Issued Jul 20, 2026 &middot; Due Aug 4, 2026 &middot; Net 15</span>
            </div>
            <div class="sub">Independent contractor &middot; digital systems &amp; automation</div>
          </div>
          <img class="client-logo" src="data:image/svg+xml;base64,${b64(clientSvg())}" alt="Anytime Fuel Pros" />
        </div>
        <div class="parties">
          <div><div class="k">From</div><div class="v"><strong>Battle Bound Branding LLC</strong>
123 Sequoia Street
Bakersfield, CA 93301
austin@battleboundbranding.com</div></div>
          <div><div class="k">Bill to</div><div class="v"><strong>Anytime Fuel Pros</strong>
4200 Diesel Way
Bakersfield, CA 93307
accounts@anytimefuelpros.com</div></div>
        </div>
        <div class="period"><span>Service period</span><b>Jul 3, 2026 &ndash; Jul 18, 2026</b></div>
        <table class="items">
          <thead><tr>
            <th>Date</th><th>Description</th>
            <th style="text-align:right">Hours</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th>
          </tr></thead>
          <tbody>${lineItems(lines)}</tbody>
        </table>
        <div class="totals"><table><tbody>
          <tr><td>Billable hours</td><td>72.00</td></tr>
          <tr><td>Rate</td><td>$95.00 / hr</td></tr>
          <tr class="grand"><td>Total due</td><td>$6,840.00</td></tr>
        </tbody></table></div>
        <div class="detail">
          <h3>Work performed</h3>
          ${workEntries(entries)}
        </div>
        <div class="foot"><span>Anytime Fuel Pros</span><span>AFP-2026-004 &middot; ${lines} sessions &middot; 72.00 h</span></div>
      </div>
    </main>
  </div>
</div>
</body>
</html>`;
}
