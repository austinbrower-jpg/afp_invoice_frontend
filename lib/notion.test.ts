import { describe, it, expect } from "vitest";
import { buildSessionProperties } from "@/lib/notion";
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
  it("stores raw hours and a 30 rate", () => {
    expect(p["Total Hours"].number).toBe(1.4);
    expect(p["Hourly Rate"].number).toBe(30);
  });
  it("marks the row billable and Draft", () => {
    expect(p["Billable"].checkbox).toBe(true);
    expect(p["Billing Status"].select.name).toBe("Draft");
  });
  it("relates to the client page", () => {
    expect(p["Client"].relation[0].id).toBe("client-page-id");
  });
});
