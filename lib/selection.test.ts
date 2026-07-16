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
  location: null,
  work: [],
  notes: null,
  ...over,
});

describe("eligibility and selection", () => {
  it("isTerminal covers Invoiced, Paid, Superseded only", () => {
    expect(isTerminal("Invoiced")).toBe(true);
    expect(isTerminal("Paid")).toBe(true);
    expect(isTerminal("Superseded")).toBe(true);
    expect(isTerminal("Reviewed")).toBe(false);
  });

  it("eligible hides non-billable and superseded unless showall", () => {
    expect(eligible(s({ billable: false }), false)).toBe(false);
    expect(eligible(s({ status: "Superseded" }), false)).toBe(false);
    expect(eligible(s({ billable: false }), true)).toBe(true);
  });

  it("autoSelect picks billable, in-range, non-terminal rows", () => {
    const rows = [
      s({ url: "a", date: "2026-07-14", status: "Reviewed" }),
      s({ url: "b", date: "2026-07-14", status: "Paid" }),
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
