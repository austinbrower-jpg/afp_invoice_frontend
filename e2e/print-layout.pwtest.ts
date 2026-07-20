// Print-layout regression for Save PDF. Guards the bug where the invoice printed as a narrow
// vertical column across five pages: the screen cockpit grid (.cockpit-split) is declared after
// the @media print block, so at equal specificity it kept display:grid in print and the paper
// auto-placed into the 400px console track. The fix is the authoritative print reset at the end
// of app/globals.css plus scoping the phone preview to @media screen.
//
// Everything runs off a self-contained fixture (real globals.css + real .paper markup), so there
// is no Next server or Notion dependency.
//
// Note on measurement: emulateMedia({ media: "print" }) switches the CSS media type but does NOT
// relayout to the @page box, so getBoundingClientRect widths are relative to the browser viewport.
// So absolute print widths ("close to Letter width") are measured with the viewport set to the
// printable Letter content box (7.5in = 720px inside the 0.5in @page margins), while the
// desktop/mobile viewports are used to prove the screen size does not leak into print. The actual
// paginated PDF is generated at both desktop and mobile to confirm identical page geometry.
import { test, expect, chromium, type Browser } from "@playwright/test";
import { buildInvoiceHtml } from "./fixture";

const HTML = buildInvoiceHtml();

// 7.5in x 9.75in printable Letter content box inside 0.5in margins, at 96dpi.
const PRINTABLE_WIDTH = 720;

const SCREEN_VIEWPORTS = [
  { label: "desktop", width: 1440, height: 1000 },
  { label: "mobile", width: 390, height: 844 },
] as const;

async function withPrintPage<T>(
  width: number,
  height: number,
  fn: (page: import("@playwright/test").Page) => Promise<T>
): Promise<T> {
  const browser: Browser = await chromium.launch({ channel: "chrome" });
  try {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.setContent(HTML, { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });
    return await fn(page);
  } finally {
    await browser.close();
  }
}

// Screen viewport must not leak into print: at every screen size the paper must fill the page as
// a full-width block, never the 400px console grid track. These ratios are viewport-independent.
for (const vp of SCREEN_VIEWPORTS) {
  test(`screen viewport ${vp.label} (${vp.width}x${vp.height}) does not leak into print`, async () => {
    const m = await withPrintPage(vp.width, vp.height, (page) =>
      page.evaluate(() => {
        const cs = (sel: string) => getComputedStyle(document.querySelector(sel)!);
        const w = (sel: string) => document.querySelector(sel)!.getBoundingClientRect().width;
        const cols = cs(".parties")
          .gridTemplateColumns.split(" ")
          .map((s) => parseFloat(s))
          .filter((n) => !Number.isNaN(n));
        return {
          paperTransform: cs(".paper").transform,
          splitDisplay: cs(".cockpit-split").display,
          paperstageDisplay: cs(".paperstage").display,
          paperFill: w(".paper") / w(".station"),
          invHeadFill: w(".inv-head") / w(".paper"),
          partiesColumns: cols,
          partiesWidth: w(".parties"),
          topbarDisplay: cs(".topbar").display,
          consoleDisplay: cs(".cockpit-console").display,
        };
      })
    );

    // The mobile scale() and any other transform must never reach print.
    expect(m.paperTransform).toBe("none");

    // The two-column cockpit grid must collapse to block flow in print; this is the regression.
    expect(m.splitDisplay).toBe("block");
    expect(m.paperstageDisplay).toBe("block");

    // The paper must fill its container, not sit in the 400px console track (the old bug put it
    // at roughly a quarter of the width). This is substantially wider than half the page.
    expect(m.paperFill).toBeGreaterThan(0.95);

    // The header row spans the full paper, not a collapsed column.
    expect(m.invHeadFill).toBeGreaterThan(0.95);

    // From / Bill to must remain two meaningful columns.
    expect(m.partiesColumns.length).toBe(2);
    for (const col of m.partiesColumns) {
      expect(col).toBeGreaterThan(m.partiesWidth * 0.25);
    }

    // No console chrome in the PDF.
    expect(m.topbarDisplay).toBe("none");
    expect(m.consoleDisplay).toBe("none");
  });
}

// Absolute print geometry, measured at the printable Letter width.
test("invoice fills the printable Letter width", async () => {
  const m = await withPrintPage(PRINTABLE_WIDTH, 960, (page) =>
    page.evaluate(() => {
      const w = (sel: string) => document.querySelector(sel)!.getBoundingClientRect().width;
      return {
        paperWidth: w(".paper"),
        invHeadWidth: w(".inv-head"),
        invTitleWidth: w(".inv-title"),
      };
    })
  );

  // Paper is close to the 720px printable Letter width, not the ~400px collapsed column.
  expect(m.paperWidth).toBeGreaterThan(690);
  expect(m.paperWidth).toBeLessThanOrEqual(722);

  // Header and its centered title keep real width (the bug collapsed the title to ~115px).
  expect(m.invHeadWidth).toBeGreaterThan(690);
  expect(m.invTitleWidth).toBeGreaterThan(300);
});

// The invoice must paginate identically no matter the screen viewport, since print geometry is
// driven by @page, not the screen.
test("print geometry is identical across screen viewports", async () => {
  async function renderPdf(width: number, height: number) {
    return withPrintPage(width, height, async (page) => {
      // preferCSSPageSize honors @page { size: letter; margin: 0.5in } from globals.css.
      const buf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
      const text = buf.toString("latin1");
      const pages = (text.match(/\/Type\s*\/Page[^s]/g) || []).length;
      const letter = /\/MediaBox\s*\[\s*0\s+0\s+612(?:\.\d+)?\s+792(?:\.\d+)?\s*\]/.test(text);
      return { pages, letter };
    });
  }

  const desktop = await renderPdf(1440, 1000);
  const mobile = await renderPdf(390, 844);

  expect(desktop.letter).toBe(true);
  expect(mobile.letter).toBe(true);

  // Screen viewport must not change how many pages the invoice prints to.
  expect(desktop.pages).toBe(mobile.pages);
  expect(desktop.pages).toBeGreaterThan(0);
  // The same 16-line fixture should stay compact, not blow out the way the regression did.
  expect(desktop.pages).toBeLessThanOrEqual(4);
});
