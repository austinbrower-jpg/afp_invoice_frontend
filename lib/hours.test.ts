import { describe, it, expect } from "vitest";
import { startOfWeekISO, weeklyEarnings } from "@/lib/hours";
import type { Payload, Session } from "@/lib/notion";

describe("startOfWeekISO", () => {
  it("anchors to the Monday of the week", () => {
    // 2026-07-15 is a Wednesday; its Monday is 2026-07-13.
    expect(startOfWeekISO("2026-07-15")).toBe("2026-07-13");
  });
});

const wk = (over: Partial<Session>): Session => ({
  id: "id-u", url: "u", date: "2026-07-14", sid: "AFP", start: "7:00 AM", end: "9:00 AM",
  brk: null, hours: 2, rate: 30, billable: true, status: "Reviewed",
  billingStatus: "unbilled",
  invoiceNumber: null,
  invoicedAt: null,
  paidAt: null,
  location: null, work: [], notes: null, ...over,
});

const payload = (hours: Session[]): Payload => ({
  client: { name: "AFP", defaultRate: 30, timezone: "", billTo: "" },
  activeClock: null,
  from: "", lastInvoice: null, hours, workDone: {},
});

describe("weeklyEarnings", () => {

  it("groups by Monday-anchored week and splits collected from owed", () => {
    const data = payload([
      wk({ url: "a", date: "2026-07-08", hours: 5.83, status: "Invoiced", billingStatus: "invoiced" }), // wk Jul 06, collected
      wk({ url: "b", date: "2026-07-14", hours: 6.54, status: "Reviewed" }),  // wk Jul 13, owed
      wk({ url: "c", date: "2026-07-15", hours: 7.63, status: "Reviewed" }),  // wk Jul 13, owed
    ]);
    const weeks = weeklyEarnings(data, "2026-07-16", 6);
    const jul13 = weeks.find((w) => w.weekStart === "2026-07-13")!;
    const jul06 = weeks.find((w) => w.weekStart === "2026-07-06")!;
    expect(jul13.owed).toBeCloseTo((6.54 + 7.63) * 30, 5);
    expect(jul13.collected).toBe(0);
    expect(jul13.amount).toBeCloseTo(jul13.owed, 5);
    expect(jul13.isCurrent).toBe(true); // Monday of 2026-07-16 is 2026-07-13
    expect(jul06.collected).toBeCloseTo(5.83 * 30, 5);
    expect(jul06.owed).toBe(0);
    expect(jul06.isCurrent).toBe(false);
  });

  it("excludes superseded and non-billable from the money", () => {
    const data = payload([
      wk({ url: "a", date: "2026-07-14", hours: 4, status: "Superseded" }),
      wk({ url: "b", date: "2026-07-14", hours: 3, billable: false }),
      wk({ url: "c", date: "2026-07-14", hours: 2, status: "Reviewed" }),
    ]);
    const weeks = weeklyEarnings(data, "2026-07-16", 6);
    const jul13 = weeks.find((w) => w.weekStart === "2026-07-13")!;
    expect(jul13.amount).toBeCloseTo(2 * 30, 5); // only the Reviewed billable row
  });

  it("returns the current week even when empty, newest first", () => {
    const data = payload([wk({ date: "2026-06-01", hours: 2, status: "Paid" })]);
    const weeks = weeklyEarnings(data, "2026-07-16", 6);
    expect(weeks[0].weekStart).toBe("2026-07-13"); // current week, at rest
    expect(weeks[0].amount).toBe(0);
    expect(weeks[0].isCurrent).toBe(true);
  });
});

describe("unbilled", () => {
  it("counts only billable unbilled sessions in scope", async () => {
    const { unbilled } = await import("@/lib/hours");
    const data = payload([
      wk({ url: "a", hours: 2, billingStatus: "unbilled" }),
      wk({ url: "b", hours: 3, billingStatus: "paid", invoiceNumber: "AFP-2026-001" }),
      wk({ url: "c", hours: 4, billingStatus: "invoiced", invoiceNumber: "AFP-2026-002" }),
      wk({ url: "d", hours: 5, billable: false, billingStatus: "unbilled" }),
    ]);
    expect(unbilled(data, "2026-07-16")).toMatchObject({ hours: 2, amount: 60, sessions: 1 });
  });
});
