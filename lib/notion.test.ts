import { describe, it, expect } from "vitest";
import { buildBillingUpdateProperties, buildSessionProperties } from "@/lib/notion";
import type { ClockPayload } from "@/lib/clock";

const input: ClockPayload = {
  dateISO: "2026-07-16",
  sessionId: "AFP-2026-07-16-0903-1027",
  startDisplay: "9:03 AM",
  endDisplay: "10:27 AM",
  hours: 1.4,
  location: "Remote",
};

describe("buildSessionProperties", () => {
  const p = buildSessionProperties(input, "client-page-id") as any;
  it("writes the ISO date as the title", () => {
    expect(p["Date"].title[0].text.content).toBe("2026-07-16");
  });
  it("sets the Session Date the app filters on", () => {
    // The app reads Session Date, not the Date title, so a session with no Session Date is
    // invisible in every range and trips assertDatesUsable. Regression guard for that bug.
    expect(p["Session Date"].date.start).toBe("2026-07-16");
  });
  it("stores raw hours and a 30 rate", () => {
    expect(p["Total Hours"].number).toBe(1.4);
    expect(p["Hourly Rate"].number).toBe(30);
  });
  it("marks the row billable and Unbilled", () => {
    expect(p["Billable"].checkbox).toBe(true);
    expect(p["Billing Status"].select.name).toBe("Unbilled");
  });
  it("relates to the client page", () => {
    expect(p["Client"].relation[0].id).toBe("client-page-id");
  });
});


describe("buildBillingUpdateProperties", () => {
  it("marks an invoice paid with invoice number and paid timestamp", () => {
    const p = buildBillingUpdateProperties("paid", "AFP-2026-003", "2026-07-20T12:00:00.000Z") as any;
    expect(p["Billing Status"].select.name).toBe("Paid");
    expect(p["Invoice Number"].rich_text[0].text.content).toBe("AFP-2026-003");
    expect(p["Paid At"].date.start).toBe("2026-07-20T12:00:00.000Z");
  });
  it("moves a paid invoice back to invoiced without clearing the invoice number", () => {
    const p = buildBillingUpdateProperties("invoiced", "AFP-2026-003", "2026-07-21T12:00:00.000Z") as any;
    expect(p["Billing Status"].select.name).toBe("Invoiced");
    expect(p["Invoice Number"].rich_text[0].text.content).toBe("AFP-2026-003");
    expect(p["Paid At"].date).toBeNull();
  });
  it("clears invoice fields only when explicitly changed back to unbilled", () => {
    const p = buildBillingUpdateProperties("unbilled") as any;
    expect(p["Billing Status"].select.name).toBe("Unbilled");
    expect(p["Invoice Number"].rich_text).toEqual([]);
  });
});
