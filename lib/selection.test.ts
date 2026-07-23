import { describe, it, expect } from "vitest";
import {
  inRange,
  isTerminal,
  eligible,
  autoSelect,
  unbilledStart,
  buildFlags,
} from "@/lib/selection";
import type { Session, Payload } from "@/lib/notion";

const s = (over: Partial<Session>): Session => ({
  url: "u",
  date: "2026-07-14",
  sid: "AFP-1",
  start: "7:00 AM",
  end: "9:00 AM",
  brk: null,
  hours: 2,
  rate: 30,
  billable: true,
  status: "Reviewed",
  billingStatus: "unbilled",
  invoiceNumber: null,
  invoicedAt: null,
  paidAt: null,
  location: null,
  work: [],
  notes: null,
  ...over,
  id: over.id ?? "id-u",
});

describe("eligibility and selection", () => {
  it("isTerminal covers Invoiced, Paid, Superseded only", () => {
    expect(isTerminal(s({ billingStatus: "invoiced" }))).toBe(true);
    expect(isTerminal(s({ billingStatus: "paid" }))).toBe(true);
    expect(isTerminal(s({ status: "Superseded" }))).toBe(true);
    expect(isTerminal(s({ status: "Reviewed", billingStatus: "unbilled" }))).toBe(false);
  });

  it("eligible hides non-billable and superseded unless showall", () => {
    expect(eligible(s({ billable: false }), false)).toBe(false);
    expect(eligible(s({ status: "Superseded" }), false)).toBe(false);
    expect(eligible(s({ billable: false }), true)).toBe(true);
  });

  it("autoSelect picks billable, in-range, non-terminal rows", () => {
    const rows = [
      s({ url: "a", date: "2026-07-14", status: "Reviewed" }),
      s({ url: "b", date: "2026-07-14", billingStatus: "paid", status: "Paid" }),
      s({ url: "c", date: "2026-07-01", status: "Reviewed" }),
    ];
    const picked = autoSelect(rows, "2026-07-13", "2026-07-15", false);
    expect(picked.has("a")).toBe(true);
    expect(picked.has("b")).toBe(false); // Paid is terminal
    expect(picked.has("c")).toBe(false); // out of range
  });

  it("inRange is inclusive on both ends", () => {
    expect(inRange(s({ date: "2026-07-13" }), "2026-07-13", "2026-07-15")).toBe(true);
    expect(inRange(s({ date: "2026-07-16" }), "2026-07-13", "2026-07-15")).toBe(false);
  });

  it("unbilledStart is the day after the last invoice period", () => {
    const data = { lastInvoice: { number: "AFP-2026-001", periodEnd: "2026-07-10" } } as Payload;
    expect(unbilledStart(data, "2026-07-16")).toBe("2026-07-11");
  });

  it("unbilledStart falls back to month start with no usable last invoice", () => {
    const data = { lastInvoice: null } as Payload;
    expect(unbilledStart(data, "2026-07-16")).toBe("2026-07-01");
  });

  it("buildFlags names a session with no linked Work Done", () => {
    const data = { workDone: {}, lastInvoice: null } as unknown as Payload;
    const flags = buildFlags(data, [s({ sid: "AFP-9", work: [] })]);
    expect(flags.join(" ")).toContain("AFP-9");
    expect(flags.join(" ")).toContain("no linked Work Done");
  });
});

it("does not auto-select invoiced or paid rows after date-range changes", () => {
  const rows = [
    s({ url: "unbilled", billingStatus: "unbilled" }),
    s({ url: "invoiced", billingStatus: "invoiced", invoiceNumber: "AFP-2026-001" }),
    s({ url: "paid", billingStatus: "paid", invoiceNumber: "AFP-2026-001", paidAt: "2026-07-20T00:00:00.000Z" }),
  ];
  const picked = autoSelect(rows, "2026-07-01", "2026-07-31", true);
  expect([...picked]).toEqual(["unbilled"]);
});
